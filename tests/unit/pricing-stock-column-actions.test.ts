import assert from 'node:assert/strict';
import test from 'node:test';
import { previewPricingStockColumn, type PricingStockColumnSource, type PricingStockSizing } from '@/shared/domain/pricingStock';
import { applyProportionalVariantWeights, createVariant } from '@/admin/features/artikli/lib/familyModel';

const sizing: PricingStockSizing = {productType:'dimensions',lengthMm:'100.000',widthMm:'20.000',thicknessMm:'5.000',weightKg:'1.000',shape:'plošča',material:'jeklo'};
const row = (variantId: number, extra: Partial<PricingStockColumnSource> = {}): PricingStockColumnSource => ({variantId,itemId:10,unit:'kos',sizing:{...sizing},inventory:5,purchaseNet:'3.00',saleNet:'10.00',workMinutes:'2.0000',otherCosts:null,...extra});

test('copy uses one explicit source and only supplied filtered targets without mutating any input', () => {
  const source=row(1,{inventory:17}), shown=row(2,{itemId:22,inventory:3}), otherPage=row(70,{itemId:70,inventory:4}), hidden=row(4,{inventory:99});
  const before=structuredClone([source,shown,otherPage,hidden]);
  const result=previewPricingStockColumn(source,[source,shown,otherPage],'inventory','copy');
  assert.equal(result.targetCount,2);assert.deepEqual(result.rows.map(entry=>[entry.variantId,entry.proposed]),[[2,'17'],[70,'17']]);
  assert.equal(result.errors.length,0);assert.equal(result.skipped.length,0);
  assert.deepEqual([source,shown,otherPage,hidden],before);
  assert.ok(result.rows.every(entry=>entry.field==='inventory'&&entry.basis==='copy'));
});

test('unknown source values block copy and scaling without erasing targets, while explicit zero is valid', () => {
  const source=row(1,{purchaseNet:null,workMinutes:null}), target=row(2);
  for (const field of ['purchaseNet','workMinutes'] as const) for (const mode of ['copy','proportional'] as const) {
    const result=previewPricingStockColumn(source,[target],field,mode);
    assert.equal(result.rows.length,0);assert.equal(result.errors[0].code,'SOURCE_VALUE_MISSING');
  }
  const zero=previewPricingStockColumn(row(1,{purchaseNet:'0.00'}),[target],'purchaseNet','proportional');
  assert.equal(zero.rows[0].proposed,'0.00');
  assert.equal(previewPricingStockColumn(row(1,{workMinutes:'0.0000'}),[target],'workMinutes','copy').rows[0].proposed,'0.0000');
  assert.equal(target.purchaseNet,'3.00');assert.equal(target.workMinutes,'2.0000');
});

test('dimension scaling reuses the editor complete-volume rule and exact ratio, with one storage rounding', () => {
  const source=row(1,{saleNet:'0.03',workMinutes:'0.0003'}), half=row(2,{sizing:{...sizing,lengthMm:'50.000'}});
  const price=previewPricingStockColumn(source,[half],'saleNet','proportional');
  assert.deepEqual(price.rows[0].ratio,{numerator:'1',denominator:'2'});assert.equal(price.rows[0].proposed,'0.02');assert.equal(price.rows[0].basis,'volume');
  assert.equal(previewPricingStockColumn(source,[half],'workMinutes','proportional').rows[0].proposed,'0.0002');
  const old=applyProportionalVariantWeights([createVariant({id:'1',length:100,width:20,thickness:5,weight:1}),createVariant({id:'2',length:50,width:20,thickness:5,weight:9}),createVariant({id:'3',length:50,width:null,thickness:5,weight:9})],'1');
  const current=previewPricingStockColumn(row(1,{saleNet:'1.00'}),[half,row(3,{sizing:{...sizing,widthMm:null}})],'saleNet','proportional');
  assert.deepEqual(current.rows.map(entry=>String(entry.variantId)),old.eligibleVariantIds);
  assert.deepEqual(current.skipped.map(entry=>String(entry.variantId)),old.skippedVariantIds);
  assert.equal(current.rows[0].proposed,old.variants[1].weight?.toFixed(2));
});

test('weight scaling applies only to compatible per-piece units and never doubles a per-kg price', () => {
  const weight={...sizing,productType:'weight' as const,weightKg:'2.000'};
  const source=row(1,{sizing:weight,saleNet:'0.10'}), target=row(2,{sizing:{...weight,weightKg:'3.000'}});
  const result=previewPricingStockColumn(source,[target],'saleNet','proportional');
  assert.equal(result.rows[0].proposed,'0.15');assert.equal(result.rows[0].basis,'weight');assert.deepEqual(result.rows[0].ratio,{numerator:'3',denominator:'2'});
  assert.equal(previewPricingStockColumn({...source,unit:'kg'},[{...target,unit:'kg'}],'saleNet','proportional').skipped[0].code,'UNIT_ALREADY_NORMALIZED');
});

test('unrelated products, units, shapes, unsupported types, and absent/nonpositive measures have explicit reasons', () => {
  const source=row(1), targets=[row(2,{itemId:11}),row(3,{unit:'paket'}),row(4,{sizing:{...sizing,shape:'cev'}}),row(5,{sizing:{...sizing,productType:'simple'}}),row(6,{sizing:undefined}),row(7,{sizing:{...sizing,widthMm:null}}),row(8,{sizing:{...sizing,widthMm:'0.000'}})];
  const result=previewPricingStockColumn(source,targets,'purchaseNet','proportional');
  assert.equal(result.rows.length,0);assert.deepEqual(result.skipped.map(entry=>entry.code),['DIFFERENT_PRODUCT','UNIT_INCOMPATIBLE','PRODUCT_PROPERTIES_DIFFER','PRODUCT_TYPE_INCOMPATIBLE','SIZING_MISSING','MEASUREMENT_MISSING','MEASUREMENT_INVALID']);
  assert.match(result.skipped[5].message,/Širina ciljne različice/u);
  assert.match(previewPricingStockColumn(row(1,{sizing:{...sizing,lengthMm:null}}),[row(2)],'saleNet','proportional').skipped[0].message,/Dolžina izvorne različice/u);
});

test('invalid actions, duplicate targets, required selling prices, and out-of-range scaled results are rejected', () => {
  const source=row(1), target=row(2,{sizing:{...sizing,lengthMm:'200.000'}});
  assert.equal(previewPricingStockColumn(source,[target],'inventory','proportional').errors[0].code,'UNSUPPORTED_COLUMN_ACTION');
  assert.equal(previewPricingStockColumn(source,[target,target],'saleNet','copy').errors[0].code,'DUPLICATE_OR_INVALID_VARIANT');
  assert.equal(previewPricingStockColumn(row(1,{saleNet:null}),[target],'saleNet','copy').errors[0].code,'SOURCE_VALUE_MISSING');
  assert.equal(previewPricingStockColumn(row(1,{saleNet:'9999999999.99'}),[target],'saleNet','proportional').errors[0].code,'OUT_OF_RANGE');
  assert.equal(previewPricingStockColumn(row(1,{workMinutes:'99999999.9999'}),[target],'workMinutes','proportional').errors[0].code,'OUT_OF_RANGE');
});
