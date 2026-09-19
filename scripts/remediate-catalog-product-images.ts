/** Guarded, image-only remediation. Dry-run by default; originals and rows are retained for rollback. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import {catalogTypeHash,parseCatalogTypeArgs,resolveCatalogTypeTarget} from './reclassify-atehna-catalog';
import {protectedHashes,readState,realPhotoProvenance,type PhotoState} from './replace-atehna-generated-images';
type Row=Record<string,unknown>;
type Identity={slug:string;blobUrl:string;sha256?:string;target?:'local'|'production'};
type Caption=Identity&{imageType:string;altText:string};
type Restore=Caption&{variantNames:string[]};
type Replacement=Caption&{fromBlobUrl:string;fromSha256:string;dimensions:{width:number;height:number};sourcePage:string;sourceUrl:string;visuallyReviewed:boolean;humanFree:boolean;originalBytes:boolean;hostedBlobUrl?:string;hostedBlobPathname?:string};
export type ImageRemediationManifest={removals:Identity[];restores:Restore[];captions:Caption[];replacements:Replacement[];partialUnassignments:Array<Identity&{variantNames:string[]}>};
const sid=(v:unknown)=>String(v);
const mediaUrl=(m:Row)=>String(m.blob_url||m.external_url||'');
const normalized=(s:unknown)=>String(s).trim().toLowerCase().replace(/\s+/g,' ');
const key=(r:Row)=>`${r.variant_id}:${r.media_id}`;
const same=(a:unknown,b:unknown)=>catalogTypeHash({value:a})===catalogTypeHash({value:b});
function ensure(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}

export function planProductImageRemediation(before:PhotoState,manifest:ImageRemediationManifest,target:'local'|'production') {
 const expected=structuredClone(before);
 const removed=new Set<string>();
 function findMedia(entry:Identity,required=true){
  const item=expected.items.find(i=>i.slug===entry.slug);ensure(item&&item.status!=='deleted',`Missing/archived item ${entry.slug}`);
  const rows=expected.media.filter(m=>sid(m.item_id)===sid(item.id)&&mediaUrl(m)===entry.blobUrl);
  ensure(rows.length<=1,`Ambiguous image ${entry.slug}/${entry.blobUrl}`);
  if(required)ensure(rows.length===1,`Missing image ${entry.slug}/${entry.blobUrl}`);
  if(rows[0])ensure(rows[0].media_kind==='image'&&rows[0].role==='gallery',`Not a product gallery image ${entry.blobUrl}`);
  return{item,row:rows[0]};
 }
 function unlink(mediaId:string,variantIds?:Set<string>){
  expected.assignments=expected.assignments.filter(a=>{const drop=sid(a.media_id)===mediaId&&(!variantIds||variantIds.has(sid(a.variant_id)));if(drop)removed.add(key(a));return!drop;});
 }
 function selectVariants(itemId:unknown,names:string[]){return names.map(name=>{
  const rows=expected.variants.filter(v=>sid(v.item_id)===sid(itemId)&&normalized(v.variant_name)===normalized(name));
  ensure(rows.length===1,`Missing/ambiguous variant ${name}`);return rows[0];
 });}
 for(const entry of manifest.removals){if(entry.target&&entry.target!==target)continue;const{row}=findMedia(entry,false);if(!row)continue;row.hidden=true;unlink(sid(row.id));}
 for(const entry of manifest.partialUnassignments){if(entry.target&&entry.target!==target)continue;const{item,row}=findMedia(entry);unlink(sid(row.id),new Set(selectVariants(item.id,entry.variantNames).map(v=>sid(v.id))));ensure(row.hidden||expected.assignments.some(a=>sid(a.media_id)===sid(row.id)),'Partial removal would make the image global: '+entry.blobUrl+'. Hide the image explicitly instead.');}
 for(const entry of manifest.restores){if(entry.target&&entry.target!==target)continue;
  const{item,row}=findMedia(entry);row.hidden=false;row.alt_text=entry.altText;row.image_type=entry.imageType;
  const variants=selectVariants(item.id,entry.variantNames);
  unlink(sid(row.id));
  for(const variant of variants){
   const old=before.assignments.find(a=>sid(a.media_id)===sid(row.id)&&sid(a.variant_id)===sid(variant.id));
   expected.assignments.push(old??{variant_id:variant.id,item_id:item.id,media_id:row.id,position:0});
  }
 }
 for(const entry of manifest.captions){if(entry.target&&entry.target!==target)continue;const{row}=findMedia(entry);row.alt_text=entry.altText;row.image_type=entry.imageType;}
 for(const entry of manifest.replacements){if(entry.target&&entry.target!==target)continue;
  const{item,row:old}=findMedia({...entry,blobUrl:entry.fromBlobUrl});
  if(target==='production')ensure(entry.hostedBlobUrl&&entry.hostedBlobPathname,'Production replacement requires a verified hosted URL and pathname.');
  const url=target==='production'?entry.hostedBlobUrl!:entry.blobUrl;
  ensure(url!==entry.fromBlobUrl,'Replacement source and destination must differ.');
  const matches=expected.media.filter(m=>sid(m.item_id)===sid(item.id)&&mediaUrl(m)===url);
  ensure(matches.length<=1&&matches.every(m=>m.media_kind==='image'&&m.role==='gallery'&&m.source_kind==='upload'),'Ambiguous or non-gallery replacement: '+url);
  let row=matches[0];
  if(!row){row={id:`new:${entry.slug}:${path.posix.basename(entry.blobUrl)}`,item_id:item.id,media_kind:'image',role:'gallery',source_kind:'upload',filename:path.posix.basename(entry.blobUrl),blob_url:url,blob_pathname:target==='production'?(entry.hostedBlobPathname??null):null,external_url:null,mime_type:'image/jpeg',video_type:null,position:old.position,hidden:false,alt_text:entry.altText,image_type:entry.imageType,image_dimensions:entry.dimensions};expected.media.push(row);}
  ensure(!row.hidden,`Reviewed replacement was independently hidden: ${url}`);
  row.alt_text=entry.altText;row.image_type=entry.imageType;
  const links=expected.assignments.filter(a=>sid(a.media_id)===sid(old.id));
  for(const link of links)if(!expected.assignments.some(a=>sid(a.media_id)===sid(row.id)&&sid(a.variant_id)===sid(link.variant_id)))expected.assignments.push({...link,media_id:row.id});
  old.hidden=true;unlink(sid(old.id));
 }
 const inserts=expected.media.filter(m=>!before.media.some(old=>sid(old.id)===sid(m.id)));
 const updates=expected.media.filter(m=>before.media.some(old=>sid(old.id)===sid(m.id)&&!same(old,m)));
 const assignmentDeletes=before.assignments.filter(a=>!expected.assignments.some(b=>key(a)===key(b)));
 const assignmentInserts=expected.assignments.filter(a=>!before.assignments.some(b=>key(a)===key(b)));
 const assignmentUpdates=expected.assignments.filter(a=>before.assignments.some(b=>key(a)===key(b)&&!same(a,b)));
 ensure(assignmentUpdates.length===0,'Existing association position changed unexpectedly.');
 const changedItemIds=[...new Set([...inserts,...updates,...assignmentDeletes,...assignmentInserts].map(r=>sid(r.item_id)))];
 return{expected,inserts,updates,assignmentDeletes,assignmentInserts,changedItemIds,mutationCount:inserts.length+updates.length+assignmentDeletes.length+assignmentInserts.length};
}

const safeAssetPath=(value:string)=>/^\/images\/catalog\/\d{4}-\d{2}\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/.test(value);
export async function validateRemediationSourceChecksums(manifest:ImageRemediationManifest,target?:'local'|'production'){
 for(const entry of [...manifest.removals.filter(entry=>!target||!entry.target||entry.target===target),...manifest.captions,...manifest.replacements.map(r=>({slug:r.slug,blobUrl:r.fromBlobUrl,sha256:r.fromSha256}))]){
  if(!entry.sha256)continue;
  const hosted=/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[a-zA-Z0-9_./%-]+$/u.test(entry.blobUrl);
  ensure(hosted||/^\/images\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(entry.blobUrl),'Unsafe recorded source path '+entry.blobUrl);
  ensure(/^[a-f0-9]{64}$/i.test(entry.sha256),'Invalid recorded source checksum '+entry.blobUrl);
  let bytes:Buffer;
  if(hosted){
   const response=await fetch(entry.blobUrl,{redirect:'error',signal:AbortSignal.timeout(15000)});if(response.status===404)continue;ensure(response.ok,'Recorded stored source is not reachable.');
   ensure(Number(response.headers.get('content-length')||0)<=20*1024*1024,'Recorded stored source exceeds20MB.');bytes=Buffer.from(await response.arrayBuffer());ensure(bytes.length<=20*1024*1024,'Recorded stored source exceeds20MB.');
  }else try{bytes=await readFile(path.join('public',entry.blobUrl));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  ensure(createHash('sha256').update(bytes).digest('hex')===entry.sha256,'Recorded source bytes changed '+entry.blobUrl);
 }
}
export async function validateRemediationAssets(manifest:ImageRemediationManifest,target:'local'|'production'){
 await validateRemediationSourceChecksums(manifest,target);
 const history=JSON.parse(await readFile('data/catalog/image-upgrades-2026-09.json','utf8'));
 const generated=realPhotoProvenance(history.products);
 for(const entry of [...manifest.restores,...manifest.replacements].filter(entry=>!entry.target||entry.target===target)){
  ensure(!generated.generatedUrls.has(entry.blobUrl),`Synthetic restoration forbidden ${entry.blobUrl}`);
  ensure(safeAssetPath(entry.blobUrl),'Unsafe asset path');
  const bytes=await readFile(path.join('public',entry.blobUrl));const digest=createHash('sha256').update(bytes).digest('hex');
  ensure(entry.sha256===digest&&!generated.generatedHashes.has(digest),`Changed or synthetic bytes ${entry.blobUrl}`);
 }
 for(const entry of manifest.replacements){
  const m=await sharp(path.join('public',entry.blobUrl)).metadata();
  ensure(m.format===(entry.blobUrl.endsWith('.png')?'png':entry.blobUrl.endsWith('.webp')?'webp':'jpeg'),'Replacement filename does not match native image format.');
  ensure(m.width===entry.dimensions.width&&m.height===entry.dimensions.height&&m.width>=1024&&m.height>=1024,'Replacement below native1024px minimum.');
  ensure(entry.originalBytes&&entry.visuallyReviewed&&entry.humanFree,'Replacement lacks required visual/native review.');
  if(target==='production'){
   ensure(entry.hostedBlobUrl,'Upload and verify immutable replacement bytes before production apply.');
   const url=new URL(entry.hostedBlobUrl);ensure(url.protocol==='https:'&&url.hostname.endsWith('.public.blob.vercel-storage.com')&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash,'Unexpected immutable image host.');
   ensure(entry.hostedBlobPathname&&decodeURIComponent(url.pathname.slice(1))===entry.hostedBlobPathname,'Hosted replacement URL/pathname mismatch.');
   const response=await fetch(url);ensure(response.ok,'Replacement is not reachable on production.');const bytes=Buffer.from(await response.arrayBuffer());
   ensure(createHash('sha256').update(bytes).digest('hex')===entry.sha256,'Hosted replacement bytes differ.');
  }
 }
}
const omitted=(row:Row,fields:string[])=>Object.fromEntries(Object.entries(row).filter(([k])=>!fields.includes(k)));
export async function runProductImageRemediation(args=process.argv.slice(2)){
 const options=parseCatalogTypeArgs(args);const connection=resolveCatalogTypeTarget(options.target,process.env.DATABASE_URL);
 const manifest=JSON.parse(await readFile('data/catalog/product-image-remediation-2026-09.json','utf8')) as ImageRemediationManifest;
 await validateRemediationAssets(manifest,options.target);
 const pool=new pg.Pool({connectionString:connection.connectionString,max:1});const client=await pool.connect();let committed=false;
 try{
  await client.query(options.apply?'begin isolation level serializable':'begin isolation level repeatable read read only');
  if(options.apply)await client.query("select pg_advisory_xact_lock(hashtext('atehna-product-image-remediation-2026-09'))");
  const before=await readState(client,options.apply);const plan=planProductImageRemediation(before,manifest,options.target);
  const summary={target:options.target,changedProducts:plan.changedItemIds.length,mediaInserts:plan.inserts.length,mediaUpdates:plan.updates.length,associationRemovals:plan.assignmentDeletes.length,associationAdditions:plan.assignmentInserts.length,mutationCount:plan.mutationCount};
  if(!options.apply){await client.query('rollback');console.log(JSON.stringify(summary));return summary;}
  const directory=`tmp/catalog-refinements/image-policy-${options.target}-${new Date().toISOString().replace(/[:.]/g,'-')}`;await mkdir(directory,{recursive:true});
  const hashes=await protectedHashes(client);const backup=Buffer.from(JSON.stringify({before,hashes,summary,manifest},null,2));await writeFile(`${directory}/before.json`,backup,{flag:'wx'});ensure(backup.equals(await readFile(`${directory}/before.json`)),'Backup reread failed.');
  const ids=new Map<string,string>();
  for(const row of plan.inserts){const keys=Object.keys(row).filter(k=>k!=='id');const sql=`insert into catalog_media (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`;const actual=(await client.query(sql,keys.map(k=>k==='image_dimensions'?JSON.stringify(row[k]):row[k]))).rows[0].id;ids.set(sid(row.id),sid(actual));}
  for(const row of plan.updates)await client.query('update catalog_media set hidden=$1,alt_text=$2,image_type=$3,updated_at=now() where id=$4',[row.hidden,row.alt_text,row.image_type,row.id]);
  for(const row of plan.assignmentDeletes)await client.query('delete from catalog_variant_media where variant_id=$1 and media_id=$2',[row.variant_id,row.media_id]);
  for(const row of plan.assignmentInserts)await client.query('insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4)',[row.variant_id,row.item_id,ids.get(sid(row.media_id))??row.media_id,row.position]);
  for(const id of plan.changedItemIds)await client.query('update catalog_items set updated_at=now() where id=$1',[id]);
  const after=await readState(client);
  ensure(same(before.variants,after.variants),'Variant data changed.');
  ensure(same(before.items.map(r=>omitted(r,['updated_at'])),after.items.map(r=>omitted(r,['updated_at']))),'Product data changed.');
  ensure(same(hashes,await protectedHashes(client)),'Protected catalog or commerce data changed.');
  ensure(after.media.length===plan.expected.media.length&&after.assignments.length===plan.expected.assignments.length,'Unexpected row count.');
  for(const expected of plan.expected.media){const id=ids.get(sid(expected.id))??sid(expected.id);const actual=after.media.find(m=>sid(m.id)===id);ensure(actual,'Media disappeared.');const omit=ids.has(sid(expected.id))?['id','created_at','updated_at']:['updated_at'];ensure(same(omitted(expected,omit),omitted(actual,omit)),`Unexpected media change ${id}`);}
  for(const expected of plan.expected.assignments){const actual=after.assignments.find(a=>sid(a.variant_id)===sid(expected.variant_id)&&sid(a.media_id)===(ids.get(sid(expected.media_id))??sid(expected.media_id)));ensure(actual&&sid(actual.position)===sid(expected.position),'Association/order verification failed.');}
  ensure(planProductImageRemediation(after,manifest,options.target).mutationCount===0,'Repeat plan is not a no-op.');
  await client.query('commit');committed=true;const verification={...summary,backup:`${directory}/before.json`,verifiedUnrelatedDataPreserved:true,repeatPlanMutations:0,cacheInvalidationRequired:['catalog-public','catalog-admin']};await writeFile(`${directory}/verification.json`,JSON.stringify(verification,null,2));console.log(JSON.stringify(verification));return verification;
 }catch(error){if(!committed)await client.query('rollback');throw error;}finally{client.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runProductImageRemediation().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
