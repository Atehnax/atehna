import test from 'node:test';
import assert from 'node:assert/strict';
import { geometryForVariant, parseMeasurement, parseRectangle, type DimensionProduct } from '../../scripts/catalog-dimensions/geometry';
import { renderMachineSketch } from '../../scripts/catalog-dimensions/machines';
import { renderDimensionOverview } from '../../scripts/catalog-dimensions/render';
import { validateDimensionSketchManifest } from '../../scripts/catalog-dimensions/sync';

test('dimensions convert explicit units and reject marketing ranges or non-length quantities',()=>{
  assert.equal(parseMeasurement('0,5 mm'),0.5);
  assert.equal(parseMeasurement('100 cm'),1000);
  assert.deepEqual(parseRectangle('44 × 16,5 cm'),[440,165]);
  for(const value of ['300 × 200, 400 × 300 mm','500 g','0 mm','-10 mm','50–100 cm']) {
    assert.equal(parseMeasurement(value),undefined);
    assert.equal(parseRectangle(value),undefined);
  }
});

test('selected product dimensions take precedence; paper grammage and shipping fields never become thickness',()=>{
  const product:DimensionProduct={slug:'penjeni-pvc-komateks',itemName:'PVC',productType:'dimensions',variants:[]};
  const v={variantName:'PVC',variantSku:'PVC-1',length:200,width:300,thickness:3,
    optionLabels:{Dimenzije:'300 × 200 mm'},contentOverride:{specifications:{Debelina:'3 mm',Dimenzije:'150 × 200, 300 × 200 mm'}}};
  assert.deepEqual([geometryForVariant(product,v)?.a,geometryForVariant(product,v)?.b],[300,200]);
  const paper={...product,slug:'barvni-papir',productType:'simple'};
  const sheet=geometryForVariant(paper,{variantName:'B2',variantSku:'B2',thickness:42,contentOverride:{specifications:{Format:'B2',Gramatura:'130 g/m²'}}});
  assert.deepEqual([sheet?.a,sheet?.b,sheet?.t],[500,707,undefined]);
  assert.equal(geometryForVariant({...product,slug:'kladivo',productType:'simple'},{variantName:'200 g',variantSku:'HAMMER',length:300,width:90,thickness:40}),null);
});

test('overview retains every variant, including equal geometries, and escapes arbitrary names',()=>{
  const product:DimensionProduct={slug:'barvni-papir',itemName:'Papir <test>',productType:'simple',variants:Array.from({length:27},(_,i)=>({id:String(i+1),variantName:'Barva '+(i+1),variantSku:'P-'+i,contentOverride:{specifications:{Format:'B2'}}}))};
  const geometries=product.variants.map(v=>geometryForVariant(product,v)!);
  const result=renderDimensionOverview(product,geometries);
  for(let i=1;i<=27;i++)assert.ok(result.svg.includes('Barva '+i));
  assert.ok(result.svg.includes('27 različic'));
  assert.ok(result.svg.includes('Papir &lt;test&gt;'));
  assert.equal(result.width,result.height);
  assert.equal(result.width,1800);
  assert.ok(!result.svg.includes('rotate('));
  for (const slug of ['vibracijska-zaga-proxxon-dsh','krivilnik-za-plasticne-mase']) {
    const machine=renderMachineSketch(slug,'Stroj')!;
    assert.equal(machine.width,machine.height);
    assert.ok(!machine.svg.includes('rotate('));
  }
});


test('a named steel rule length is geometry, but unrelated model names are not dimensions', () => {
  const product: DimensionProduct = {slug:'jeklena-merilna-letvica',itemName:'Jeklena merilna letvica',productType:'simple',variants:[]};
  const geometry = geometryForVariant(product,{id:'1',variantName:'300 mm',variantSku:'RULE-300'});
  assert.equal(geometry?.kind,'ruler');
  assert.equal(geometry?.a,300);
  assert.equal(geometry?.b,undefined);
  assert.equal(geometry?.t,undefined);
  assert.equal(geometryForVariant(product,{variantName:'R300',variantSku:'RULE-300'}),null);
});

test('individual sketch manifests require exactly one exclusive image for every configured variant', () => {
  const variants = ['1','2'].map(id => ({id,variantSku:'ALU-'+id,variantName:'Variant '+id,length:300,width:200,thickness:0.5,contentOverride:null,optionLabels:{}}));
  const images = variants.map(variant => ({url:'/images/catalog/2026-09/dimenzije/alu-'+variant.id+'.svg',filename:'alu-'+variant.id+'.svg',imageType:'dimension-diagram',width:1800,height:1800,sha256:'a'.repeat(64),altText:'Diagram',variantIds:[variant.id],variantSkus:[variant.variantSku]}));
  const manifest = {version:1,mode:'per-variant',products:[{slug:'aluminijasta-plosca',itemId:'10',variantSnapshot:variants,images}]};
  assert.equal(validateDimensionSketchManifest(manifest),manifest);
  const missing=structuredClone(manifest);missing.products[0].images.pop();
  assert.throws(()=>validateDimensionSketchManifest(missing),/Every configured variant/);
  const shared=structuredClone(manifest);shared.products[0].images[0].variantIds=['1','2'];shared.products[0].images[0].variantSkus=['ALU-1','ALU-2'];
  assert.throws(()=>validateDimensionSketchManifest(shared),/exactly one variant/);
  const duplicate=structuredClone(manifest);duplicate.products[0].images[1].variantIds=['1'];duplicate.products[0].images[1].variantSkus=['ALU-1'];
  assert.throws(()=>validateDimensionSketchManifest(duplicate),/More than one sketch/);
  const wrongSku=structuredClone(manifest);wrongSku.products[0].images[0].variantSkus=['ALU-2'];
  assert.throws(()=>validateDimensionSketchManifest(wrongSku),/differs from its snapshot/);
});
