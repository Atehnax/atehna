/** Read-only catalog media inventory; never updates database records. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import pg from 'pg';
import {realPhotoProvenance} from './replace-atehna-generated-images';
import {resolveCatalogTypeTarget} from './reclassify-atehna-catalog';
const targetName=process.argv.includes('--production')?'production':'local';
const connection=resolveCatalogTypeTarget(targetName,process.env.DATABASE_URL);
const out=`tmp/product-image-audit/${targetName}`;
await mkdir(out,{recursive:true});
const pool=new pg.Pool({connectionString:connection.connectionString,max:1});
const client=await pool.connect();
let items:any[],variants:any[],media:any[],links:any[];
try {
 await client.query('begin isolation level repeatable read read only');
 items=(await client.query('select id,slug,item_name,status,brand,material,colour,shape,default_variant_id from catalog_items order by id')).rows;
 variants=(await client.query('select id,item_id,variant_name,variant_sku,status,position,length,width,thickness from catalog_item_variants order by item_id,position,id')).rows;
 media=(await client.query('select * from catalog_media order by item_id,position,id')).rows;
 links=(await client.query('select variant_id,item_id,media_id,position from catalog_variant_media order by variant_id,position,media_id')).rows;
 await client.query('rollback');
} finally {client.release();await pool.end();}
const provenance=new Map<string,any[]>();
function visit(value:any,file:string){
 if(!value||typeof value!=='object')return;
 if(typeof value.blobUrl==='string'){provenance.set(value.blobUrl,[...(provenance.get(value.blobUrl)||[]),{manifest:file,...value}]);if(typeof value.hostedBlobUrl==='string')provenance.set(value.hostedBlobUrl,[...(provenance.get(value.hostedBlobUrl)||[]),{manifest:file,...value}]);}
 for(const child of Object.values(value))visit(child,file);
}
for(const file of await readdir('data/catalog'))if(file.endsWith('.json')&&!file.startsWith('product-image-audit')) visit(JSON.parse(await readFile(`data/catalog/${file}`,'utf8')),file);
const historical=JSON.parse(await readFile('data/catalog/image-upgrades-2026-09.json','utf8'));
const synthetic=realPhotoProvenance(historical.products);
const images:any[]=[];
const remoteBytes=new Map<string,Buffer>();
for(const row of media!){
 if(row.media_kind!=='image')continue;
 const url=row.blob_url||row.external_url||'';
 const p=provenance.get(url)||[];
 let measured:any={};
 if(url.startsWith('/')&&!url.includes('..'))try{
  const bytes=await readFile(path.join('public',url)); const m=await sharp(bytes).metadata();
  measured={width:m.width,height:m.height,format:m.format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 }catch(e){measured={error:(e as Error).message};}
 else if(/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(url))try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`HTTP${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());const m=await sharp(bytes).metadata();remoteBytes.set(url,bytes);measured={width:m.width,height:m.height,format:m.format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),remoteBytesVerified:true};}catch(e){measured={error:(e as Error).message};}
 else measured={error:'Remote or missing source; native bytes not measured'};
 const photo=row.role==='gallery'&&!['dimension-diagram','dimension-overview'].includes(row.image_type);
 const sources=p.filter(x=>x.sourceUrl||x.sourcePage||x.notes||x.quality||x.kind).map(x=>({manifest:x.manifest,sourcePage:x.sourcePage,sourceUrl:x.sourceUrl,kind:x.kind,quality:x.quality,notes:x.notes,contextOnly:x.contextOnly,visuallyVerified:x.visuallyVerified,variantIndices:x.variantIndices,generated:x.generated}));
 const generated=synthetic.generatedUrls.has(url)||synthetic.generatedHashes.has(measured.sha256)||sources.some(x=>/generated|illustration|render/i.test(x.kind||''))||p.some(x=>x.generationPrompt||x.prompt);
 images.push({...row,measured,photo,dimensionsMeetMinimum:measured.width>=1024&&measured.height>=1024,generated,sources,assignedVariantIds:links!.filter(x=>x.media_id===row.id).map(x=>x.variant_id)});
}
const products=items!.map(item=>({...item,variants:variants!.filter(v=>v.item_id===item.id),images:images.filter(m=>m.item_id===item.id)}));
const photos=images.filter(x=>x.photo);
const visible=photos.filter(x=>!x.hidden);
const result={version:1,auditedAt:new Date().toISOString(),scope:targetName,database:connection.database,summary:{items:items!.length,activeItems:items!.filter(x=>x.status==='active').length,variants:variants!.length,imageRows:images.length,photographRows:photos.length,visiblePhotographRows:visible.length,visibleUniquePhotographs:new Set(visible.map(x=>x.measured.sha256||x.blob_url)).size,visibleRowsBelowMinimum:visible.filter(x=>!x.dimensionsMeetMinimum).length,hiddenPhotographRows:photos.length-visible.length,dimensionDiagrams:images.length-photos.length,unreadableVisible:visible.filter(x=>x.measured.error).length},products};
await writeFile(`${out}/inventory.json`,JSON.stringify(result,null,2));

await writeFile(`${out}/contact-index.json`,JSON.stringify(visible.map((x,i)=>({index:i,id:x.id,slug:items!.find(y=>y.id===x.item_id)?.slug,url:x.blob_url,dimensions:x.measured,context:x.image_type})),null,2));
const cellW=280,cellH=250,columns=5,rows=4;
const escape=(s:string)=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
for(let page=0;page<Math.ceil(visible.length/(columns*rows));page++){
 const entries=visible.slice(page*columns*rows,(page+1)*columns*rows);const composite=[];
 for(let i=0;i<entries.length;i++){
  const entry=entries[i];const left=i%columns*cellW,top=Math.floor(i/columns)*cellH;
  if(!entry.measured.error){
   const thumb=await sharp(remoteBytes.get(entry.blob_url)??path.join('public',entry.blob_url)).resize(cellW-12,cellH-55,{fit:'inside',withoutEnlargement:true}).flatten({background:'white'}).png().toBuffer();
   const meta=await sharp(thumb).metadata();composite.push({input:thumb,left:left+Math.round((cellW-meta.width!)/2),top:top+Math.round((cellH-55-meta.height!)/2)});
  }
  const slug=items!.find(x=>x.id===entry.item_id)?.slug||'';
  const label=`<svg width="${cellW}" height="55"><rect width="100%" height="100%" fill="#eef1f6"/><text x="5" y="16" font-size="12" font-family="Arial">${escape(String(entry.id)+' '+slug.slice(0,34))}</text><text x="5" y="34" font-size="12" font-family="Arial">${entry.measured.width||'?'} x ${entry.measured.height||'?'} ${escape(String(entry.image_type||''))}</text><text x="5" y="50" font-size="10" font-family="Arial">${escape(path.basename(entry.blob_url||'').slice(0,43))}</text></svg>`;
  composite.push({input:Buffer.from(label),left,top:top+cellH-55});
 }
 await sharp({create:{width:cellW*columns,height:cellH*rows,channels:3,background:'white'}}).composite(composite).jpeg({quality:90}).toFile(`${out}/contact-${page+1}.jpg`);
}
console.log(JSON.stringify({...result.summary,output:out}));
