import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogBaseSku, buildCatalogDimensionSkuSuffix } from '../../src/shared/domain/catalog/catalogSku';
import { planCatalogSkus } from '../../scripts/correct-atehna-catalog-skus';

test('SKU prefix includes every category level and transliterates Slovenian letters', () => {
  assert.equal(buildCatalogBaseSku(['Materiali','Kovine'], 'Aluminijasta plošča'), 'MAT-KOV-ALU');
  assert.equal(buildCatalogBaseSku(['Materiali','Kovine','Pločevina'], 'Železna plošča'), 'MAT-KOV-PLO-ZEL');
  assert.equal(buildCatalogDimensionSkuSuffix({ thickness:0.5,length:300,width:200 }), '0P5x300x200');
});

test('catalog SKU plan keeps dimensions first and distinguishes attributes and prefix collisions', () => {
  const products = [
    { id:'1',slug:'baker',item_name:'Bakrena plošča',sku:'OLD-BAK',category_path:['Materiali','Kovine'],product_type:'dimensions' },
    { id:'2',slug:'kraft',item_name:'UHU Kraft',sku:'OLD-KRAFT',category_path:['Materiali','Lepila'],product_type:'simple' },
    { id:'3',slug:'super',item_name:'UHU Super glue',sku:'OLD-SUPER',category_path:['Materiali','Lepila'],product_type:'simple' }
  ];
  const variants = [
    { id:'1',item_id:'1',variant_name:'300 × 200 × 0,5 mm',variant_sku:'OLD-1',thickness:0.5,length:300,width:200 },
    { id:'2',item_id:'2',variant_name:'42 g',variant_sku:'OLD-2',thickness:null,length:null,width:null },
    { id:'3',item_id:'3',variant_name:'3 ml',variant_sku:'OLD-3',thickness:null,length:null,width:null }
  ];
  const result = planCatalogSkus(products, variants);
  assert.equal(result[0].variants[0].after, 'MAT-KOV-BAK-0P5x300x200');
  assert.equal(result[1].after, 'MAT-LEP-UHU-KRA');
  assert.equal(result[2].after, 'MAT-LEP-UHU-SUP');
  assert.equal(result[1].variants[0].after, 'MAT-LEP-UHU-KRA-42-G');
  assert.deepEqual(planCatalogSkus(products.map((product,index) => ({...product,sku:result[index].after})), variants.map((variant,index) => ({...variant,variant_sku:result[index].variants[0].after}))), result.map(item => ({...item,before:item.after,variants:item.variants.map(variant=>({...variant,before:variant.after}))})));
  assert.throws(() => planCatalogSkus(products, [...variants,{...variants[0],id:'4'}]), /collision/);
});
