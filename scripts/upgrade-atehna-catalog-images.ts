/** Add reviewed catalog photos, prefer accurate new variant assignments, retain a rollback snapshot. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import pg from 'pg';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';

type Row = Record<string, unknown>;
type Addition = { id:string; blobUrl:string; dimensions:{width:number;height:number}; sha256:string; visuallyVerified:boolean; quality:string; altText?:string; kind:string };
type RetainedAssignment = { target:'local'|'production'; dimensions:{length:number;width:number;thickness:number}; addImageIds:string[] };
type Upgrade = { slug:string; additions:Addition[]; currentMediaAudit:Array<{blobUrl:string;quality:string;visuallyVerified?:boolean;verifiedVariantIndices?:number[];contextOnly?:boolean}>; variantAssignments:Array<{variantName:string;originalIndex:number;oldSku:string;existingBlobUrls?:string[];preferredExistingBlobUrls?:string[];removeExistingBlobUrls?:string[];hasVerifiedProductImage?:boolean;addImageIds:string[]}>; retainedVariantAssignments?:RetainedAssignment[] };
type SourceProduct = { slug:string; variants:Array<{variantName:string;variantSku:string;length?:number; width?:number;thickness?:number}> };
const ensure = (value:unknown, message:string) => { if(!value) throw new Error(message); };
const normalized = (value:unknown) => String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
const omit = (row:Row, keys:string[]) => Object.fromEntries(Object.entries(row).filter(([key])=>!keys.includes(key)));

export function matchImageUpgradeVariant(assignment:Upgrade['variantAssignments'][number], source:SourceProduct, variants:Row[]) {
  const expected = source.variants[assignment.originalIndex];
  ensure(expected && normalized(expected.variantName) === normalized(assignment.variantName), `Manifest variant identity changed: ${source.slug}/${assignment.originalIndex}`);
  const comparableName = (value:unknown) => normalized(value).replace(/×/g,'x').replace(/,/g,'.').replace(/\s+/g,'');
  const onlyMeasures = (value:unknown) => /^(?:\d+(?:[,.]\d+)?\s*[x×]\s*){1,2}\d+(?:[,.]\d+)?\s*(?:mm)?$/i.test(String(value).trim());
  const sameDimensions = (variant:Row) => ['length','width','thickness'].every(key => {
    const wanted=expected[key as 'length'|'width'|'thickness'];
    return wanted == null ? variant[key] == null : Number(variant[key]) === wanted;
  });
  const sameIdentity = (variant:Row) => comparableName(variant.variant_name) === comparableName(assignment.variantName)
    || (onlyMeasures(variant.variant_name) && onlyMeasures(assignment.variantName) && sameDimensions(variant));
  let matches = variants.filter(variant => [expected.variantSku,assignment.oldSku].map(normalized).includes(normalized(variant.variant_sku)));
  ensure(matches.every(sameIdentity), `SKU was reused or its variant identity changed: ${source.slug}/${assignment.variantName}`);
  if (!matches.length) matches = variants.filter(sameIdentity);
  ensure(matches.length===1, `Variant image target is missing or ambiguous: ${source.slug}/${assignment.variantName}`);
  return matches[0];
}

/** Retained legacy formats are opt-in by environment and verified physical identity. */
export function matchRetainedImageVariant(assignment:RetainedAssignment, variants:Row[]) {
  ensure(Object.values(assignment.dimensions).every(value=>Number.isFinite(value)&&value>0),'Retained variant dimensions must be positive.');
  const matches=variants.filter(variant=>Object.entries(assignment.dimensions).every(([key,value])=>Number(variant[key])===value));
  ensure(matches.length===1,'Retained dimensional variant is missing or ambiguous.');
  ensure(/^(?:\d+(?:[,.]\d+)?\s*[x×]\s*){2}\d+(?:[,.]\d+)?\s*(?:mm)?$/i.test(String(matches[0].variant_name).trim()),'Retained variant has a descriptive identity that requires review.');
  return matches[0];
}

/** Keep the reviewed gallery order ahead of original media, including on a repeated apply. */
export function planReviewedImagePositions<T extends {blobUrl:string}>(additions:T[], currentMedia:Row[]) {
  const original=currentMedia.filter(row=>!additions.some(image=>image.blobUrl===row.blob_url));
  const firstPosition=Math.min(0,...original.map(row=>Number(row.position)))-additions.length;
  return additions.map((addition,index)=>({addition,position:firstPosition+index,existing:currentMedia.find(row=>row.blob_url===addition.blobUrl&&row.media_kind==='image'&&row.role==='gallery')}));
}

async function protectedHashes(client:pg.PoolClient) {
  const hashes:Record<string,string>={};
  for (const table of ['catalog_item_variants','catalog_item_editor_details','catalog_categories','catalog_option_axes','catalog_option_values','catalog_variant_option_values','catalog_item_quantity_discounts','catalog_supplier_rows','pricing_stock_history','pricing_stock_model']) {
    if(!(await client.query('select to_regclass($1) as name',[table])).rows[0].name)continue;
    hashes[table]=catalogTypeHash((await client.query(`select row_to_json(t) as row from ${table} t order by row_to_json(t)::text`)).rows);
  }
  return hashes;
}

export async function runCatalogImageUpgrade(args=process.argv.slice(2)) {
  const options=parseCatalogTypeArgs(args);
  const target=resolveCatalogTypeTarget(options.target,process.env.DATABASE_URL);
  const upgrades=JSON.parse(await readFile('data/catalog/image-upgrades-2026-09.json','utf8')) as {products:Upgrade[]};
  const source=JSON.parse(await readFile('data/catalog/atehna-2026-09.json','utf8')) as {products:SourceProduct[]};
  ensure(upgrades.products.length===43 && new Set(upgrades.products.map(product=>product.slug)).size===43,'Expected43 distinct reviewed products.');
  const mimeByUrl = new Map<string,string>();
  for(const product of upgrades.products) {
    ensure(source.products.some(entry=>entry.slug===product.slug),`Unknown product: ${product.slug}`);
    ensure(new Set(product.additions.map(image=>image.id)).size===product.additions.length,`Duplicate image ID: ${product.slug}`);
    for(const addition of product.additions) {
      ensure(addition.visuallyVerified && /^\/images\/catalog\/2026-09\/[a-z0-9-]+\.(png|jpe?g|webp)$/i.test(addition.blobUrl),`Unreviewed or invalid asset: ${addition.blobUrl}`);
      const bytes=await readFile(path.join('public',addition.blobUrl));
      ensure(createHash('sha256').update(bytes).digest('hex')===addition.sha256,`Asset changed after review: ${addition.blobUrl}`);
      const metadata=await sharp(bytes).metadata();
      ensure(metadata.width===addition.dimensions.width && metadata.height===addition.dimensions.height,`Image dimensions differ: ${addition.blobUrl}`);
      mimeByUrl.set(addition.blobUrl,metadata.format==='jpeg'?'image/jpeg':`image/${metadata.format}`);
    }
    for(const assignment of [...product.variantAssignments,...product.retainedVariantAssignments??[]]) for(const id of assignment.addImageIds) ensure(product.additions.some(image=>image.id===id),`Missing image reference: ${product.slug}/${id}`);
  }
  const pool=new pg.Pool({connectionString:target.connectionString,max:1});const client=await pool.connect();let committed=false;
  try {
    await client.query(options.apply?'begin isolation level serializable':'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name===target.database,'Unexpected database.');
    if(options.apply) {
      await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-image-upgrade-2026-09'))");
      await client.query('lock table catalog_items,catalog_item_variants,catalog_media,catalog_variant_media in share row exclusive mode');
    }
    const items=(await client.query('select * from catalog_items order by id')).rows;
    const variants=(await client.query('select * from catalog_item_variants order by item_id,position,id')).rows;
    const media=(await client.query('select * from catalog_media order by id')).rows;
    const assignments=(await client.query('select * from catalog_variant_media order by variant_id,media_id')).rows;
    const plans=upgrades.products.map(product=>{
      const item=items.find(item=>item.slug===product.slug);ensure(item && item.status!=='deleted',`Missing/archived article: ${product.slug}`);
      const itemVariants=variants.filter(variant=>String(variant.item_id)===String(item.id));
      const sourceProduct=source.products.find(entry=>entry.slug===product.slug)!;
      const targets=product.variantAssignments.map(assignment=>{
        const additions=assignment.addImageIds.map(id=>product.additions.find(image=>image.id===id)!);
        const verifiedExisting=(url:string)=>product.currentMediaAudit.some(image=>image.blobUrl===url&&image.visuallyVerified&&image.quality.startsWith('high-quality')&&!image.contextOnly&&(!image.verifiedVariantIndices||image.verifiedVariantIndices.includes(assignment.originalIndex)));
        ensure((assignment.preferredExistingBlobUrls??[]).every(verifiedExisting),'Preferred existing image is not a verified hero for this variant.');
        const existing=(assignment.preferredExistingBlobUrls?.length?assignment.preferredExistingBlobUrls:additions.length?[]:assignment.existingBlobUrls??[]).filter(verifiedExisting).map(blobUrl=>({blobUrl}));
        const removeBlobUrls=assignment.removeExistingBlobUrls??[];
        ensure(removeBlobUrls.every(url=>product.currentMediaAudit.some(image=>image.blobUrl===url)),'Removal refers to an unaudited image.');
        ensure(removeBlobUrls.every(url=>![...additions,...existing].some(image=>image.blobUrl===url)),'An image is both preferred and rejected.');
        return {variant:matchImageUpgradeVariant(assignment,sourceProduct,itemVariants),images:[...existing,...additions],removeBlobUrls,hasVerifiedProductImage:assignment.hasVerifiedProductImage===true};
      });
      for(const assignment of product.retainedVariantAssignments??[]) if(assignment.target===options.target) targets.push({variant:matchRetainedImageVariant(assignment,itemVariants),images:assignment.addImageIds.map(id=>product.additions.find(image=>image.id===id)!),removeBlobUrls:[],hasVerifiedProductImage:true});
      ensure(new Set(targets.map(target=>String(target.variant.id))).size===targets.length,'An image target appears more than once.');
      return {product,item,itemVariants,targets};
    });
    const summary={target:options.target,products:plans.filter(plan=>plan.product.additions.length).length,newImages:plans.flatMap(plan=>plan.product.additions.filter(image=>!media.some(row=>String(row.item_id)===String(plan.item.id)&&row.blob_url===image.blobUrl))).length,variantsWithPreferredImages:plans.flatMap(plan=>plan.targets).filter(target=>target.images.length).length};
    console.log(JSON.stringify(summary));
    if(!options.apply){await client.query('rollback');return summary;}
    const directory=path.join('tmp/catalog-refinements',`images-${options.target}-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
    const hashes=await protectedHashes(client);
    const snapshot=Buffer.from(JSON.stringify({items,media,assignments,hashes,summary},null,2));const backup=path.join(directory,'before.json');
    await writeFile(backup,snapshot,{flag:'wx'});ensure(snapshot.equals(await readFile(backup)),'Backup verification failed.');
    const removedAssignmentKeys=new Set<string>();
    const changedItemIds=new Set<string>();const addedIds=new Set<string>();const modifiedMediaIds=new Set<string>();const movedMediaIds=new Set<string>();const expectedMediaPositions=new Map<string,number>();const changedVariantIds=new Set<string>();
    for(const plan of plans) {
      const idsByImage=new Map<string,string>(media.filter(row=>String(row.item_id)===String(plan.item.id)&&row.media_kind==='image'&&row.role==='gallery'&&!row.hidden).map(row=>[String(row.blob_url),String(row.id)]));
      const currentMedia=media.filter(row=>String(row.item_id)===String(plan.item.id));
      for(const {addition,position,existing} of planReviewedImagePositions(plan.product.additions,currentMedia)) {
        ensure(!existing?.hidden, `Reviewed replacement was hidden by an editor; review before applying: ${addition.blobUrl}`);
        let id=existing?.id;
        if(!existing) {
          id=(await client.query(`insert into catalog_media(item_id,media_kind,role,source_kind,filename,blob_url,mime_type,alt_text,image_dimensions,hidden,position) values($1,'image','gallery','upload',$2,$3,$4,$5,$6::jsonb,false,$7) returning id`,[plan.item.id,path.basename(addition.blobUrl),addition.blobUrl,mimeByUrl.get(addition.blobUrl),addition.altText??plan.item.item_name,JSON.stringify(addition.dimensions),position])).rows[0].id;
          addedIds.add(String(id));changedItemIds.add(String(plan.item.id));
        } else if(Number(existing.position)!==position) {
          await client.query('update catalog_media set position=$1,updated_at=now() where id=$2',[position,id]);
          movedMediaIds.add(String(id));changedItemIds.add(String(plan.item.id));
        }
        expectedMediaPositions.set(String(id),position);
        idsByImage.set(addition.blobUrl,String(id));
      }
      for(const target of plan.targets.filter(target=>target.images.length)) {
        const wanted=target.images.map(image=>{const id=idsByImage.get(image.blobUrl);ensure(id,`Reviewed image is missing or hidden: ${image.blobUrl}`);return id!;});
        const current=assignments.filter(row=>String(row.variant_id)===String(target.variant.id)).sort((a,b)=>Number(a.position)-Number(b.position)||Number(a.media_id)-Number(b.media_id));
        const rejected=current.filter(row=>target.removeBlobUrls.includes(String(media.find(image=>String(image.id)===String(row.media_id))?.blob_url)));
        for(const row of rejected){
          await client.query('delete from catalog_variant_media where variant_id=$1 and media_id=$2',[target.variant.id,row.media_id]);
          removedAssignmentKeys.add(String(target.variant.id)+':'+String(row.media_id));changedVariantIds.add(String(target.variant.id));changedItemIds.add(String(plan.item.id));
        }
        const ordered=[...new Set([...wanted,...current.filter(row=>!rejected.includes(row)).map(row=>String(row.media_id))])];
        for(const [position,mediaId] of ordered.entries()) {
          const existing=current.find(row=>String(row.media_id)===mediaId);
          if(existing&&Number(existing.position)===position)continue;
          await client.query(`insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4) on conflict(variant_id,media_id) do update set position=excluded.position`,[target.variant.id,plan.item.id,mediaId,position]);
          changedVariantIds.add(String(target.variant.id));changedItemIds.add(String(plan.item.id));
        }
      }
      const covered=new Set(plan.targets.filter(target=>target.images.length&&target.hasVerifiedProductImage).map(target=>String(target.variant.id)));
      for(const old of currentMedia) {
        const audit=plan.product.currentMediaAudit.find(image=>image.blobUrl===old.blob_url);
        if(!audit||!['low-resolution-source','best-available-source'].includes(audit.quality)||old.hidden)continue;
        const linked=assignments.filter(row=>String(row.media_id)===String(old.id));
        const affected=linked.length?linked.map(row=>String(row.variant_id)):plan.itemVariants.map(variant=>String(variant.id));
        if(!affected.length||!affected.every(id=>covered.has(id)))continue;
        await client.query('update catalog_media set hidden=true,updated_at=now() where id=$1',[old.id]);
        modifiedMediaIds.add(String(old.id));changedItemIds.add(String(plan.item.id));
      }
    }
    for(const id of changedItemIds) await client.query('update catalog_items set updated_at=now() where id=$1',[id]);
    const afterItems=(await client.query('select * from catalog_items order by id')).rows;
    const afterMedia=(await client.query('select * from catalog_media order by id')).rows;
    const afterAssignments=(await client.query('select * from catalog_variant_media order by variant_id,media_id')).rows;
    ensure(catalogTypeHash(items.map(row=>omit(row,['updated_at'])))===catalogTypeHash(afterItems.map(row=>omit(row,['updated_at']))),'Article content changed.');
    for(const before of media) {
      const after=afterMedia.find(row=>String(row.id)===String(before.id));ensure(after,'Existing media was removed.');
      const hiddenChanged=modifiedMediaIds.has(String(before.id));
      const positionChanged=movedMediaIds.has(String(before.id));
      const allowed=[...(hiddenChanged?['hidden']:[]),...(positionChanged?['position']:[]),...(hiddenChanged||positionChanged?['updated_at']:[])];
      ensure(catalogTypeHash(omit(before,allowed))===catalogTypeHash(omit(after,allowed)),'Existing media metadata changed unexpectedly.');
    }
    ensure(afterMedia.length===media.length+addedIds.size,'Unexpected media row count.');
    for(const [id,position] of expectedMediaPositions) ensure(Number(afterMedia.find(row=>String(row.id)===id)?.position)===position,`Reviewed gallery image position failed: ${id}`);
    for(const before of assignments) {
      const after=afterAssignments.find(row=>String(row.variant_id)===String(before.variant_id)&&String(row.media_id)===String(before.media_id));
      if(removedAssignmentKeys.has(String(before.variant_id)+':'+String(before.media_id))){ensure(!after,'Rejected image assignment remains.');continue;}
      ensure(after,'Existing image assignment was lost.');
      ensure(catalogTypeHash(omit(before,changedVariantIds.has(String(before.variant_id))?['position']:[]))===catalogTypeHash(omit(after,changedVariantIds.has(String(before.variant_id))?['position']:[])),'Unrelated assignment changed.');
    }
    for(const plan of plans) for(const target of plan.targets.filter(target=>target.images.length)) {
      const assigned=afterAssignments.filter(row=>String(row.variant_id)===String(target.variant.id)).sort((a,b)=>Number(a.position)-Number(b.position));
      target.images.forEach((image,index)=>ensure(afterMedia.find(row=>String(row.id)===String(assigned[index]?.media_id))?.blob_url===image.blobUrl,`Preferred variant image failed: ${plan.product.slug}`));
    }
    ensure(catalogTypeHash(hashes)===catalogTypeHash(await protectedHashes(client)),'Protected catalog or commerce data changed.');
    await client.query('commit');committed=true;
    const verification={...summary,addedImages:addedIds.size,removedIncorrectAssignments:removedAssignmentKeys.size,hiddenLowResolutionImages:modifiedMediaIds.size,reorderedImages:movedMediaIds.size,changedVariants:changedVariantIds.size,changedItems:changedItemIds.size,protectedDataUnchanged:true,backup};
    await writeFile(path.join(directory,'verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify(verification));return verification;
  } catch(error){if(!committed)await client.query('rollback');throw error;}finally{client.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) runCatalogImageUpgrade().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
