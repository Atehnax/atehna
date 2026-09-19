import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const base='output/product-images/2026-09-19-delivery';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const material=await read(base+'/consolidated-review-v1/material-plan.json');
const non=await read(base+'/consolidated-review-v1/nonmaterial-plan.json');
const canon=await read('data/catalog/atehna-2026-09.json');
const root=process.cwd(), dest='/images/catalog/2026-09/reviewed-local/';
await fs.mkdir(path.join(root,'public',dest),{recursive:true});
const copied=new Map(), originals=new Map();
async function stage(ref,slug){
 const file=path.resolve(root,ref.file),b=await fs.readFile(file),sha=hash(b);
 if(ref.sha256 && sha!==ref.sha256)throw Error('Reviewed hash changed: '+ref.file);
 const m=await sharp(b).metadata();
 if(m.width!==ref.width||m.height!==ref.height)throw Error('Dimensions changed: '+ref.file);
 if(b.length>20*1024*1024)throw Error('Over20MB: '+ref.file);
 const ext=m.format==='jpeg'?'jpg':m.format;
 if(!['jpg','png','webp'].includes(ext))throw Error('Unexpected raster format');
 const url=dest+slug+'-'+sha.slice(0,16)+'.'+ext;
 if(!copied.has(url)){await fs.writeFile(path.join(root,'public',url),b);copied.set(url,{blobUrl:url,sha256:sha,width:m.width,height:m.height,source:ref.file,bytes:b.length});}
 return{blobUrl:url,sha256:sha,width:m.width,height:m.height,mimeType:'image/'+(ext==='jpg'?'jpeg':ext)};
}
const proposed=[];
for(const a of material.assets)proposed.push({id:a.id,slug:a.slug,variantSkus:a.variantSkus,role:a.role==='main'?'main':a.role==='diagram'?'diagram':'detail',master:{file:a.displayFile,sha256:a.sha256,width:a.width,height:a.height},caption:a.caption,generated:true,provenance:a.provenance,order:proposed.length});
const mainIds=new Set(non.variants.filter(v=>v.mainAvailable).map(v=>v.mainAssetId));
for(const a of non.assets){
 const nativeCrop=/display-native/.test(a.display?.file||'');
 proposed.push({id:a.id,slug:a.slug,variantSkus:a.variantSkus,role:mainIds.has(a.id)?'main':'detail',master:a.master,display:nativeCrop?a.display:undefined,caption:a.caption,generated:a.generated,provenance:a.provenance||a.packageManifest,imageType:a.role==='context'?'context':'product',order:a.orderAdded??0});
 for(const alt of a.alternatePresentations||[])proposed.push({id:alt.id,slug:a.slug,variantSkus:a.variantSkus,role:'detail',master:alt.master,caption:alt.caption,generated:false,provenance:alt.provenance,imageType:'context',order:alt.orderAdded??1000});
}
const supplement=await read(base+'/gallery-details-v2/manifest.json');
for(const a of supplement.assets.filter(a=>['pleksi-steklo','lepenka'].includes(a.slug)))proposed.push({id:'reference-'+a.id,slug:a.slug,variantSkus:a.variantSkus,role:'detail',master:{...a.master,file:base+'/gallery-details-v2/'+a.master.file},caption:a.caption,generated:false,imageType:'context',provenance:base+'/gallery-details-v2/manifest.json',order:999});
// User preference: no authored description text inside gallery images.
const noDescriptions=await read('data/catalog/reviewed-local-no-description-overrides-2026-09.json');
for(const replacement of noDescriptions.replacements){
 const asset=proposed.find(a=>a.id===replacement.id);
 if(!asset)throw Error('Missing description-free replacement '+replacement.id);
 asset.master=replacement.master;
 if(replacement.caption)asset.caption=replacement.caption;
 if(replacement.imageType)asset.imageType=replacement.imageType;
 if(replacement.provenance)asset.provenance=replacement.provenance;
 delete asset.display;
}
for(const omitted of noDescriptions.omit){
 const index=proposed.findIndex(a=>a.id===omitted.id);
 if(index<0)throw Error('Missing caption-dependent detail '+omitted.id);
 proposed.splice(index,1);
}
const explicitExceptions=new Map([
 ['fefbf5692b67014682f37c84a98769b0d1bc761f098a99d377c98c6c272c05f8','ruler-native-aspect-exception-v1.json'],
 ['b05a87bae6aac89d2ac507f71cbd6385a50cb4ed7c3ec9493e42e1e2561f03af','switch-underside-resolution-exception-v1.json'],
 ['b1f563cc682ad27d3a935f1ab6ee0c87139ade69bd0627c90d267482cf8c6a30','pliers-native-width-exception-v1.json'],
 ['c3a03cff3fea055090d5d1d1d894069c335154f6417059f995d55e842d9040cf','ruler-rear-native-height-exception-v1.json']
]);
proposed.sort((a,b)=>a.slug.localeCompare(b.slug)||({main:0,detail:1,diagram:2}[a.role]-{main:0,detail:1,diagram:2}[b.role])||a.order-b.order);
const merged=new Map();
for(const a of proposed){
 const product=canon.products.find(p=>p.slug===a.slug);
 if(!product||!a.variantSkus.every(s=>product.variants.some(v=>v.variantSku===s)))throw Error('Canonical mismatch '+a.id);
 const original=await stage(a.master,a.slug),display=a.display?await stage(a.display,a.slug):original;
 if((original.width<1024||original.height<1024)&&a.role!=='diagram'&&!explicitExceptions.has(original.sha256))throw Error('Missing explicit exception: '+a.id);
 originals.set(original.blobUrl,{...original,resolutionException:explicitExceptions.get(original.sha256)||null});
 let caption=a.caption||product.itemName;
 if(a.generated&&a.role!=='diagram'&&!/ilustr/iu.test(caption))caption+=' Ilustrativni prikaz izdelka.';
 const entry={id:a.id,slug:a.slug,variantSkus:a.variantSkus,role:a.role,blobUrl:display.blobUrl,mimeType:display.mimeType,altText:caption,imageType:a.role==='diagram'?'diagram':a.imageType||'product',imageDimensions:{width:display.width,height:display.height,...(a.display?{originalUrl:original.blobUrl,originalWidth:original.width,originalHeight:original.height}:{})},sha256:display.sha256,generated:a.generated,provenance:a.provenance,originalSha256:original.sha256};
 const key=a.slug+'\n'+entry.blobUrl;
 if(merged.has(key)){
  const old=merged.get(key);if(old.role!==entry.role)throw Error('Duplicate source role conflict');
  old.variantSkus=[...new Set([...old.variantSkus,...entry.variantSkus])];
  if(old.altText!==entry.altText)old.altText=product.itemName+' - ilustrativni prikaz materiala. Mere so navedene pri izbrani različici.';
 }else merged.set(key,entry);
}
const assets=[...merged.values()],coveredSkus=[...new Set(assets.flatMap(a=>a.variantSkus))];
for(const sku of coveredSkus){if(assets.filter(a=>a.role==='main'&&a.variantSkus.includes(sku)).length!==1)throw Error('Main selection conflict '+sku);}
const ledger={version:1,createdAt:new Date().toISOString(),scope:'Local website only. Do not upload, publish or push. Exact reviewed assignments; generated assets remain disclosed.',assets,coveredSkus,sourceOriginals:[...originals.values()],exclusions:non.exclusions,unresolvedSkus:['STR-KRI-OSNOVNA','DOD-ZIC-100-G'],preserveAluminium:true,preserveExistingSchematics:true,sourceScopeFile:base+'/user-scope-updates-v6.json'};
await fs.writeFile('data/catalog/reviewed-local-gallery-2026-09.json',JSON.stringify(ledger,null,2)+'\n');
await fs.writeFile(base+'/consolidated-review-v1/staging-verification.json',JSON.stringify({createdAt:new Date().toISOString(),assets:assets.length,coveredSkus:coveredSkus.length,families:new Set(assets.map(a=>a.slug)).size,copiedFiles:copied.size,totalBytes:[...copied.values()].reduce((n,a)=>n+a.bytes,0),originals:[...originals.values()],allReviewedHashesMatch:true,allDimensionsMatch:true,noApplicationStateChangedYet:true},null,2)+'\n');
console.log(JSON.stringify({assets:assets.length,coveredSkus:coveredSkus.length,families:new Set(assets.map(a=>a.slug)).size,files:copied.size,bytes:[...copied.values()].reduce((n,a)=>n+a.bytes,0)}));
