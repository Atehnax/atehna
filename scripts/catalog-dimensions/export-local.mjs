import fs from 'node:fs/promises';
import nextEnv from '@next/env';
import pg from 'pg';
import { resolveCatalogTypeTarget } from '../reclassify-atehna-catalog';
nextEnv.loadEnvConfig(process.cwd(), true);
const raw=process.env.DATABASE_URL?.trim();
if(!raw) throw new Error('Local database not configured');
resolveCatalogTypeTarget('local', raw);
const url=new URL(raw);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Remote database refused');
if(['host','port','dbname'].some(key=>url.searchParams.has(key))) throw new Error('Target override refused');
const pool=new pg.Pool({connectionString:raw,ssl:false,max:1,options:'-c default_transaction_read_only=on'});
const client=await pool.connect();
try {
 await client.query('begin isolation level repeatable read read only');
 const identity=(await client.query('select current_database() as database, inet_server_addr()::text as address')).rows[0];
 if(identity.database!==decodeURIComponent(url.pathname.slice(1)) || !['127.0.0.1','::1'].includes(identity.address?.split('/')[0])) throw new Error('Unexpected local database identity');
 const products=(await client.query(`select ci.id::text, ci.item_name as "itemName", ci.slug, ci.status, ci.item_type as "itemType",
 ci.material,ci.colour,ci.shape,ci.description, ci.category_id as "categoryId",
 ci.shipping_weight_grams as "shippingWeightGrams",ci.shipping_length_mm as "shippingLengthMm",
 ci.shipping_width_mm as "shippingWidthMm",ci.shipping_height_mm as "shippingHeightMm",
 cied.product_type as "productType",cied.data as "typeSpecificData"
 from catalog_items ci left join catalog_item_editor_details cied on cied.item_id=ci.id
 where ci.deleted_at is null order by ci.id`)).rows;
 const ids=products.map(p=>p.id);
 const variants=(await client.query(`select id::text,item_id::text as "itemId",variant_name as "variantName",variant_sku as "variantSku", status, position,length,width,thickness,weight,
 shipping_weight_grams as "shippingWeightGrams",shipping_length_mm as "shippingLengthMm",shipping_width_mm as "shippingWidthMm",shipping_height_mm as "shippingHeightMm",
 content_override_json as "contentOverride"
 from catalog_item_variants where item_id=any($1::bigint[]) order by item_id,position,id`,[ids])).rows;
 const selections=(await client.query(`select cvov.variant_id::text as "variantId", coa.name as axis, cov.value,cov.swatch from catalog_variant_option_values cvov
 join catalog_option_axes coa on coa.id=cvov.axis_id join catalog_option_values cov on cov.id=cvov.option_value_id
 join catalog_item_variants civ on civ.id=cvov.variant_id where civ.item_id=any($1::bigint[]) order by civ.item_id,civ.position,coa.position`,[ids])).rows;
 for(const p of products) p.variants=variants.filter(v=>v.itemId===p.id).map(v=>({...v,options:selections.filter(o=>o.variantId===v.id).map(({axis,value,swatch})=>({axis,value,swatch}))}));
 const media=(await client.query(`select id::text,item_id::text as "itemId",media_kind as "mediaKind",role,blob_url as "blobUrl",external_url as "externalUrl",filename,image_type as "imageType",hidden,position,image_dimensions as "imageDimensions",alt_text as "altText" from catalog_media where item_id=any($1::bigint[]) order by item_id,position,id`,[ids])).rows;
 const assignments=(await client.query(`select cvm.media_id::text as "mediaId",cvm.variant_id::text as "variantId" from catalog_variant_media cvm join catalog_item_variants civ on civ.id=cvm.variant_id where civ.item_id=any($1::bigint[]) order by cvm.media_id,cvm.variant_id`,[ids])).rows;
 for(const p of products) {p.variants=p.variants.map(v=>({...v,optionLabels:Object.fromEntries(v.options.map(o=>[o.axis,o.value]))}));p.media=media.filter(m=>m.itemId===p.id).map(m=>({...m,variantIds:assignments.filter(a=>a.mediaId===m.id).map(a=>a.variantId)}));}
 await fs.mkdir('tmp/catalog-refinements',{recursive:true});
 await fs.writeFile('tmp/catalog-refinements/dimension-products-local.json',JSON.stringify(products,null,2));
 const categories=(await client.query('select id,parent_id,slug,title,status from catalog_categories order by position,title')).rows;
 await fs.mkdir('tmp/catalog-dimension-audit',{recursive:true});
 await fs.writeFile('tmp/catalog-dimension-audit/local-inventory.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'verified loopback database',products,categories},null,2));
 console.log(JSON.stringify({localFamilies:products.length,activeFamilies:products.filter(p=>p.status==='active').length,variants:variants.length,activeVariants:variants.filter(v=>v.status==='active').length,media:media.length,output:'tmp/catalog-refinements/dimension-products-local.json'},null,2));
 await client.query('rollback');
} finally {client.release();await pool.end();}
