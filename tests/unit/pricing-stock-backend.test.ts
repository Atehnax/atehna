import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createDefaultPricingStockModel } from '@/shared/domain/pricingStock';
import { normalizePricingStockBatch, requirePricingStockRevision } from '@/shared/server/pricingStockTransaction';
import { overlayCanonicalEditorPricing } from '@/shared/server/pricingStockEditorData';
import { normalizeWeightProductData, buildWeightCatalogVariants, syncWeightVariantsWithFractionInventory } from '@/admin/features/artikli/components/pricing/productData';
import { createVariant } from '@/admin/features/artikli/lib/familyModel';

const request = (patch:Record<string,unknown>) => ({expectedModelRevision:'2',rows:[{variantId:42,expectedStockRevision:'7',expectedPricingRevision:'3',patch}]});
test('batch normalization preserves explicit zero versus unknown costs, exact decimal strings and relevant revision tokens',()=>{
  assert.deepEqual(normalizePricingStockBatch(request({purchaseNet:null,workMinutes:'0',otherCosts:'0,10',saleNet:'22,235'})).rows[0],{variantId:42,expectedPricingRevision:'3',patch:{purchaseNet:null,workMinutes:'0.0000',otherCosts:'0.10',saleNet:'22.24'}});
  assert.deepEqual(normalizePricingStockBatch(request({inventory:0})).rows[0],{variantId:42,expectedStockRevision:'7',patch:{inventory:0}});
});
test('invalid patch fields, nonnumeric/negative values, duplicate variants, missing CAS and huge batches are rejected',()=>{
  for(const patch of [{saleNet:null},{inventory:1.2},{inventory:-1},{saleNet:'Infinity'},{otherCosts:'-0.1'},{purchaseNet:12},{constructor:'0'},{['__proto__']:'0'},{untrusted_sql:'1'}])assert.throws(()=>normalizePricingStockBatch(request(patch)));
  const duplicate=request({saleNet:'1'});duplicate.rows.push(duplicate.rows[0]);assert.throws(()=>normalizePricingStockBatch(duplicate));
  assert.throws(()=>normalizePricingStockBatch({expectedModelRevision:'0',rows:[{variantId:1,patch:{inventory:1}}]}));
  assert.throws(()=>normalizePricingStockBatch({expectedModelRevision:'0',rows:Array.from({length:501},(_,i)=>({variantId:i+1,expectedStockRevision:'0',patch:{inventory:1}}))}));
  for(const revision of ['-1','1.5','9223372036854775808',1,null])assert.throws(()=>requirePricingStockRevision(revision));
});
test('combined batch accepts a strictly validated candidate model without trusting its revision for CAS',()=>{
  const model={...createDefaultPricingStockModel('0'),formula:'1 / prodajna_cena'};
  const normalized=normalizePricingStockBatch({...request({saleNet:'10'}),model});
  assert.equal(normalized.expectedModelRevision,'2');assert.equal(normalized.model?.formula,model.formula);
  assert.equal(normalized.rows[0].patch.saleNet,'10.00');
  for(const invalid of [null,{}, {...model,formula:'process.exit()'}])assert.throws(()=>normalizePricingStockBatch({...request({saleNet:'10'}),model:invalid}));
  assert.throws(()=>normalizePricingStockBatch({...request({saleNet:'10'}),model,extra:true}));
});
test('canonical variants replace old mirrored editor finances without mutating presentation data',()=>{
  const stored={simple:{basePrice:999,stock:999,warehouseLocation:'Polica A'},uniqueMachine:{basePrice:999,stock:999,serialNumbers:['P-1']}};
  const result=overlayCanonicalEditorPricing(stored,[{id:3,price:20,costNet:5,inventory:7,discountPct:10,stockRevision:'4',pricingRevision:'2'}]);
  assert.deepEqual(result.simple,{basePrice:20,stock:7,warehouseLocation:'Polica A',discountPercent:10,actionPrice:18,actionPriceEnabled:true});
  assert.equal((result.uniqueMachine as Record<string,unknown>).stock,7);assert.equal(stored.simple.stock,999);
});
test('weight SKU inventory stays distinct through editor normalization and serialization; explicit group edits still synchronize',()=>{
  const stored={weight:{fraction:'0-1',netMassKg:1,packagingChips:['1','2'],fractionChips:['0-1'],colorChips:['Siva'],fractionInventory:[{id:'group',fraction:'0-1',color:'Siva',stockKg:999,reservedKg:0,deliveryTime:'3 dni'}],variants:[{id:'10',sku:'A',fraction:'0-1',color:'Siva',netMassKg:1,unitPrice:999,stockKg:999},{id:'11',sku:'B',fraction:'0-1',color:'Siva',netMassKg:2,unitPrice:999,stockKg:999}]}};
  const overlay=overlayCanonicalEditorPricing(stored,[{id:10,variantSku:'A',price:10,costNet:3,inventory:4,stockRevision:'2',pricingRevision:'1'},{id:11,variantSku:'B',price:15,costNet:5,inventory:9,stockRevision:'3',pricingRevision:'2'}]);
  const data=normalizeWeightProductData(overlay.weight);
  assert.deepEqual(data.variants.map(v=>[v.stockKg,v.unitPrice,v.costNet]),[[4,10,3],[9,15,5]]);
  const variants=buildWeightCatalogVariants(data,'BASE');assert.deepEqual(variants.map(v=>[v.stock,v.price,v.stockRevision]),[[4,10,'2'],[9,15,'3']]);
  const changed=syncWeightVariantsWithFractionInventory(data.variants,[{...data.fractionInventory[0],stockKg:12,reservedKg:0}]);
  assert.deepEqual(normalizeWeightProductData({...data,variants:changed}).variants.map(v=>v.stockKg),[12,12]);
  assert.equal(createVariant({stock:4}).stock,4);
});
test('private API denies unauthenticated reads and cross-origin writes before any database access',()=>{
  const code=`import assert from 'node:assert/strict';
    import {GET,PATCH} from './src/admin/api/pricing-stock/route.ts';
    import {createAdminSessionToken,getAdminAuthConfig,ADMIN_SESSION_COOKIE} from './src/shared/auth/adminSession.ts';
    const denied=await GET(new Request('http://localhost:3000/api/admin/pricing-stock'));
    assert.equal(denied.status,401);assert.match(denied.headers.get('cache-control'),/no-store/);assert.doesNotMatch(await denied.text(),/purchaseNet|actor|rows/);
    const session=createAdminSessionToken(getAdminAuthConfig());
    const headers={'content-type':'application/json',cookie:ADMIN_SESSION_COOKIE+'='+session.token,origin:'https://foreign.example',host:'localhost:3000','sec-fetch-site':'cross-site'};
    const deniedWrite=await PATCH(new Request('http://localhost:3000/api/admin/pricing-stock',{method:'PATCH',headers,body:JSON.stringify({expectedModelRevision:'0',rows:[{variantId:1,expectedStockRevision:'0',patch:{inventory:1}}]})}));
    assert.equal(deniedWrite.status,403);
    const nullSale=await PATCH(new Request('http://localhost:3000/api/admin/pricing-stock',{method:'PATCH',headers:{...headers,origin:'http://localhost:3000','sec-fetch-site':'same-origin'},body:JSON.stringify({expectedModelRevision:'0',rows:[{variantId:1,expectedPricingRevision:'0',patch:{saleNet:null}}]})}));
    assert.equal(nullSale.status,400);const nullSaleBody=await nullSale.json();assert.equal(nullSaleBody.issues[0].code,'REQUIRED');console.log('private boundary passed');`;
  const result=spawnSync(process.execPath,['--conditions=react-server','--import','tsx','--input-type=module','-e',code],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,NODE_ENV:'development',ADMIN_USERNAME:'pricing-test',ADMIN_PASSWORD:'test-only',ADMIN_SESSION_SECRET:'test-only-session-secret',DATABASE_URL:''}});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/private boundary passed/);
});
