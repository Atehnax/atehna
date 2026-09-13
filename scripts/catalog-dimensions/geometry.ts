/** Product measurements only: shipping dimensions and SKU numbers are never parsed. */
export type DimensionVariant = {
  id?: string; variantName: string; variantSku: string; status?: string; position?: number;
  length?: number | string | null; width?: number | string | null; thickness?: number | string | null;
  contentOverride?: { specifications?: Record<string, string> } | null;
  optionLabels?: Record<string, string>;
};
export type DimensionProduct = {
  id?: string; slug: string; itemName: string; productType: string;
  variants: DimensionVariant[];
};
export type Geometry = {
  kind: 'plate' | 'ruler' | 'motor' | 'work-area' | 'triangle';
  a: number; b?: number; t?: number; shaft?: number;
  name: string; variantSku: string; variantId?: string; colour?: string; material?: string;
  format?: string; side?: 'hypotenuse' | 'long-leg'; angle?: number; basis: string[]; detail?: string; auxiliary?: string[];
};
const number = (s: string) => Number(s.replace(',', '.'));
export function parseMeasurement(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/i);
  if (!match) return undefined;
  const n = number(match[1]) * ({mm:1,cm:10,m:1000}[match[2].toLowerCase()] ?? 1);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
export function parseRectangle(value: unknown): [number, number] | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/i);
  if (!m) return undefined;
  const unit = ({mm:1,cm:10,m:1000}[m[3].toLowerCase()] ?? 1);
  const result: [number, number] = [number(m[1])*unit,number(m[2])*unit];
  return result.every(n => Number.isFinite(n) && n > 0) ? result : undefined;
}
const sheets = new Set(['aluminijasta-plosca','bakrena-plosca','medeninasta-plosca','pocinkana-plocevina','penjeni-pvc-komateks','pleksi-steklo','stiropor','seleshamer','barvni-papir','grafopak','fotokarton','lepenka','risalni-list','vezana-plosca','podlaga-za-rezanje']);
const paper: Record<string,[number,number]> = {A5:[148,210],A4:[210,297],A3:[297,420],A2:[420,594],B2:[500,707],B1:[707,1000]};
const positive = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v)>0 ? Number(v) : undefined;
export function geometryForVariant(product: DimensionProduct, variant: DimensionVariant): Geometry | null {
  const specs = variant.contentOverride?.specifications ?? {};
  const base = { name: variant.variantName, variantSku: variant.variantSku, variantId: variant.id,
    colour: specs.Barva ?? specs['Izvedba materiala'], material: specs.Material ?? specs.Les, basis: [] as string[] };
  if (sheets.has(product.slug)) {
    let rect: [number,number] | undefined;
    let basis = '';
    for (const [key,value] of Object.entries(variant.optionLabels ?? {})) {
      if (/dimenz|velikost plo/i.test(key)) {
        rect = parseRectangle(value); if (rect) {basis = 'Izbrana lastnost: '+key; break;}
      }
    }
    for (const key of ['Velikost plošče','Dimenzije']) {
      if (!rect) {rect = parseRectangle(specs[key]); if(rect) basis = 'Specifikacija: '+key;}
    }
    const format = specs.Format?.trim().toUpperCase();
    if (!rect && format && paper[format]) {rect = paper[format];basis='Specifikacija Format '+format+' (standardni format)';}
    // Only these reviewed sheet families use the legacy numeric fields for product geometry.
    if (!rect && product.productType === 'dimensions') {
      const a = positive(variant.length), b = positive(variant.width);
      if(a && b) {rect=[a,b];basis='Preverjene mere plošče: length / width';}
    }
    if (!rect) return null;
    const t = parseMeasurement(specs.Debelina) ?? (product.productType === 'dimensions' ? positive(variant.thickness) : undefined);
    return {...base,kind:'plate',a:rect[0],b:rect[1],t,format,basis:[basis,...(t?['Debelina plošče']:[])]};
  }
  if (['ravnila-za-tablo','aluminijasto-ravnilo-z-rocajem','jeklena-merilna-letvica'].includes(product.slug)) {
    const namedLength = product.slug === 'jeklena-merilna-letvica' ? parseMeasurement(variant.variantName) : undefined;
    const a = parseMeasurement(specs.Dolžina) ?? namedLength;
    if (!a) return null;
    const profile = parseRectangle(specs.Profil);
    return {...base,kind:'ruler',a,b:profile?.[0],t:profile?.[1],basis:[parseMeasurement(specs.Dolžina) ? 'Specifikacija Dolžina' : 'Izrecna dolžina ravnila v nazivu različice',...(profile?['Specifikacija Profil']:[])],detail:profile?'Mere ravnila; višina ročaja ni navedena.':'Dolžina ravnila; širina in debelina nista navedeni.'};
  }
  if (['geotrikotnik','trikotniki-za-tablo'].includes(product.slug)) {
    const a=parseMeasurement(String(specs.Velikost??'').split(/,\s+(?=[a-z])/i)[0]);
    const angle=product.slug==='geotrikotnik'?45:Number(String(specs.Kot??'').replace('°',''));
    if(!a || ![45,60].includes(angle)) return null;
    const side=angle===45?'hypotenuse':'long-leg';
    return {...base,kind:'triangle',a,side,angle,basis:['Specifikaciji Velikost / Kot','Pomen velikosti potrjen na točnih dobaviteljevih fotografijah skale'],detail:'Ostale stranice in debelina niso navedene.'};
  }
  if(product.slug==='motorcek') {
    const a=parseMeasurement(specs['Dolžina motorja']), b=parseMeasurement(specs['Premer motorja']),shaft=parseMeasurement(specs['Premer osi']);
    if(!a || !b) return null;
    return {...base,kind:'motor',a,b,shaft,basis:['Dolžina motorja','Premer motorja','Premer osi'],detail:'Dolžina ohišja; dolžina osi ni navedena.'};
  }
  if(['vibracijska-zaga-proxxon-dsh','krivilnik-za-plasticne-mase'].includes(product.slug)) {
    const key=product.slug==='vibracijska-zaga-proxxon-dsh'?'Delovna miza':'Delovna površina';
    const rect=parseRectangle(specs[key]);
    if(!rect) return null;
    const auxiliary=product.slug==='vibracijska-zaga-proxxon-dsh'
      ? ['Razdalja do stebra: '+specs['Razdalja do stebra'],'Največja globina reza: '+specs['Največja globina reza'],'Hod žage: '+specs.Hod]
      : ['Dolžina grelne žice: '+specs['Dolžina grelne žice'],'Največja debelina materiala: '+specs['Največja debelina materiala']];
    return {...base,kind:'work-area',a:rect[0],b:rect[1],basis:['Specifikacija '+key],detail:key+' · pogled od zgoraj',auxiliary:auxiliary.filter(x=>!x.endsWith('undefined'))};
  }
  return null;
}
