import assert from 'node:assert/strict';import test from 'node:test';
import { matchImageUpgradeVariant, matchRetainedImageVariant, planReviewedImagePositions } from '../../scripts/upgrade-atehna-catalog-images';
const source={slug:'pleksi-steklo',variants:[{variantName:'150 x 200 x 3 mm, belo',variantSku:'MAT-UME-PLE-3x200x150-BELO',length:200,width:150,thickness:3}]};
const assignment={variantName:source.variants[0].variantName,originalIndex:0,oldSku:'ATE-13102',addImageIds:['white']};
const white={id:1,variant_sku:'ATE-13102',variant_name:source.variants[0].variantName,length:200,width:150,thickness:3};
test('image upgrade requires matching variant identity even for a matching SKU',()=>{
 assert.equal(matchImageUpgradeVariant(assignment,source,[white]).id,1);
 assert.throws(()=>matchImageUpgradeVariant(assignment,source,[{...white,variant_name:'150 x 200 x 3 mm, prozorno'}]),/identity changed/);
 assert.throws(()=>matchImageUpgradeVariant(assignment,source,[{...white,variant_sku:'OTHER',variant_name:'150 x 200 x 3 mm, prozorno'}]),/missing or ambiguous/);
 assert.throws(()=>matchImageUpgradeVariant({...assignment,originalIndex:1},source,[white]),/identity changed/);
});
test('dimension-only metal variants match historical dimension naming without matching a reused SKU',()=>{
 const metal={slug:'aluminijasta-plosca',variants:[{variantName:'300 × 200 × 0,5 mm',variantSku:'MAT-KOV-ALU-0P5x300x200',length:300,width:200,thickness:0.5}]};
 const target={variantName:metal.variants[0].variantName,originalIndex:0,oldSku:'OLD',addImageIds:['rect']};
 assert.equal(matchImageUpgradeVariant(target,metal,[{id:5,variant_sku:'LEGACY',variant_name:'0,5 x 300 x 200 mm',length:300,width:200,thickness:0.5}]).id,5);
 assert.throws(()=>matchImageUpgradeVariant(target,metal,[{id:6,variant_sku:'OLD',variant_name:'300 x 200 x 1 mm',length:300,width:200,thickness:1}]),/identity changed/);
});

test('retained variants require unique physical dimensions and a dimension-only identity',()=>{
 const target={target:'production' as const,dimensions:{length:200,width:100,thickness:0.5},addImageIds:['narrow']};
 const row={id:2,variant_name:'0,5 × 200 × 100 mm',length:'200.000',width:'100.000',thickness:'0.500'};
 assert.equal(matchRetainedImageVariant(target,[row]).id,2);
 assert.throws(()=>matchRetainedImageVariant(target,[row,{...row,id:3}]),/ambiguous/);
 assert.throws(()=>matchRetainedImageVariant(target,[{...row,thickness:1}]),/missing/);
 assert.throws(()=>matchRetainedImageVariant(target,[{...row,variant_name:'200 x 100 x 0,5 mm, belo'}]),/descriptive identity/);
 assert.throws(()=>matchRetainedImageVariant({...target,dimensions:{...target.dimensions,width:0}},[row]),/positive/);
});


test('reapplying a reviewed gallery order moves existing additions and then becomes a no-op',()=>{
 const additions=[{blobUrl:'/hero.jpg'},{blobUrl:'/context.jpg'}];
 const media=[
  {id:1,blob_url:'/original.jpg',position:0,media_kind:'image',role:'gallery',hidden:true,alt_text:'Original'},
  {id:2,blob_url:'/context.jpg',position:-2,media_kind:'image',role:'gallery',hidden:false,alt_text:'Editor context caption'},
  {id:3,blob_url:'/hero.jpg',position:-1,media_kind:'image',role:'gallery',hidden:false,alt_text:'Editor hero caption'},
 ];
 const before=structuredClone(media);
 const moves=planReviewedImagePositions(additions,media).filter(row=>row.existing&&Number(row.existing.position)!==row.position);
 assert.deepEqual(moves.map(row=>[row.existing!.id,row.position]),[[3,-2],[2,-1]]);
 for(const row of moves) media.find(image=>image.id===row.existing!.id)!.position=row.position;
 assert.deepEqual(media.map(({position: _position,...rest})=>rest),before.map(({position: _position,...rest})=>rest));
 assert.equal(media[0].position,0);
 assert.deepEqual([...media].sort((a,b)=>a.position-b.position).map(row=>row.blob_url),['/hero.jpg','/context.jpg','/original.jpg']);
 assert.equal(planReviewedImagePositions(additions,media).filter(row=>!row.existing||Number(row.existing.position)!==row.position).length,0);
});

test('adding another reviewed image keeps additions before originals with negative positions',()=>{
 const media=[{id:1,blob_url:'/original.jpg',position:-5,media_kind:'image',role:'gallery'},{id:2,blob_url:'/hero.jpg',position:-6,media_kind:'image',role:'gallery'}];
 const plan=planReviewedImagePositions([{blobUrl:'/hero.jpg'},{blobUrl:'/context.jpg'}],media);
 assert.deepEqual(plan.map(row=>[row.addition.blobUrl,row.position,row.existing?.id]),[['/hero.jpg',-7,2],['/context.jpg',-6,undefined]]);
 assert.equal(media[0].position,-5);
});
