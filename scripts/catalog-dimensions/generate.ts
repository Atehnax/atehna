/** Render reviewed product measurements into one independently assigned SVG per variant. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { geometryForVariant, type DimensionProduct } from './geometry';
import { renderVariantDimensionSketch } from './render-variant';
import { renderMachineSketch } from './machines';
import { validateDimensionSketchManifest } from './sync';

type SourceProduct = DimensionProduct & { id: string };
const inputPath = process.argv[2] ?? 'tmp/catalog-refinements/dimension-products-local.json';
const products = JSON.parse(await readFile(inputPath, 'utf8')) as SourceProduct[];
const source = JSON.parse(await readFile('data/catalog/atehna-2026-09-sources.json', 'utf8')) as { products: {slug:string; sourceUrl?:string;sourceUrls?:string[]}[] };
const triangles = JSON.parse(await readFile('data/catalog/dimension-triangle-sources-2026-09.json', 'utf8')) as {products:{slug:string;sourceUrls:string[]}[]};
const output = 'public/images/catalog/2026-09/dimenzije';
await mkdir(output, { recursive: true });
const prepared = [];
const skipped = [];
for (const product of products) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || !/^[1-9]\d*$/.test(product.id) || !product.variants.length) throw new Error('Invalid catalog diagram source identity.');
  const measurements = product.variants.map(variant => geometryForVariant(product, variant));
  if (measurements.every(geometry => geometry === null)) {
    skipped.push({slug:product.slug,variantIds:product.variants.map(variant=>variant.id),reason:'Mere izdelka niso popolne ali pomen mer ni potrjen.'});
    continue;
  }
  if (measurements.some(geometry => geometry === null)) throw new Error('Incomplete variant geometry: ' + product.slug);
  const images = [];
  const machine = renderMachineSketch(product.slug, product.itemName);
  for (const [index, variant] of product.variants.entries()) {
    if (!variant.id || !/^[1-9]\d*$/.test(variant.id) || !variant.variantSku?.trim()) throw new Error('Invalid variant identity: ' + product.slug);
    const geometry = measurements[index]!;
    if (machine && (geometry.kind !== 'work-area' ||
      (product.slug === 'vibracijska-zaga-proxxon-dsh' ? geometry.a !== 360 || geometry.b !== 180 : geometry.a !== 440 || geometry.b !== 165))) {
      throw new Error('Machine work-area dimensions differ from the reviewed drawing: ' + product.slug);
    }
    const rendered = machine ?? renderVariantDimensionSketch(product, geometry);
    const sha256 = createHash('sha256').update(rendered.svg).digest('hex');
    const variantKey = variant.variantSku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = product.slug + '-dimenzijska-skica-' + variantKey + '-' + sha256.slice(0,12) + '.svg';
    await writeFile(output + '/' + filename, rendered.svg, 'utf8');
    images.push({url:'/images/catalog/2026-09/dimenzije/' + filename, filename,
      imageType:'dimension-diagram' as const, width:rendered.width, height:rendered.height, sha256,
      altText:product.itemName + ' — dimenzijska skica različice ' + variant.variantName + '. Shematski prikaz; uporabljajte navedene mere.',
      variantIds:[variant.id], variantSkus:[variant.variantSku]});
  }
  const supplier = source.products.find(entry=>entry.slug===product.slug);
  prepared.push({slug:product.slug,itemId:product.id,
    variantSnapshot:product.variants.map(variant=>({id:variant.id!,variantSku:variant.variantSku,variantName:variant.variantName,length:variant.length==null?null:Number(variant.length),width:variant.width==null?null:Number(variant.width),thickness:variant.thickness==null?null:Number(variant.thickness),contentOverride:variant.contentOverride??null,optionLabels:variant.optionLabels??{}})),
    measurements,
    sourceUrls:machine?.basis??triangles.products.find(entry=>entry.slug===product.slug)?.sourceUrls??supplier?.sourceUrls??(supplier?.sourceUrl?[supplier.sourceUrl]:[]),
    sourceNotes:product.slug.match(/^(aluminijasta|bakrena|medeninasta|pocinkana)/)
      ? 'Mere po navodilu uporabnika in trenutne različice v lokalnem katalogu.'
      : product.slug==='jeklena-merilna-letvica' ? 'Dolžina 300 mm je izrecno navedena v nazivu trenutne lokalne različice; širina in debelina nista navedeni.' : undefined,
    images});
}
const manifest = {version:1,mode:'per-variant',environment:'local',inputPath,
  style:'Individual square technical SVGs on white, with top/side views where measured, large horizontal dimension labels and arrows. One exclusive variant assignment per sketch. Photographs retained.',
  products:prepared,skipped};
validateDimensionSketchManifest(manifest);
await writeFile('data/catalog/dimension-sketches-2026-09.json', JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({products:prepared.length,variants:prepared.reduce((count,product)=>count+product.measurements.length,0),images:prepared.reduce((count,product)=>count+product.images.length,0),skippedProducts:skipped.length,manifest:'data/catalog/dimension-sketches-2026-09.json'},null,2));
