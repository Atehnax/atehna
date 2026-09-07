import { compareExact, divideExact, EXACT_ONE, EXACT_ZERO, formatExactDecimal, multiplyExact, parseExactDecimal, type ExactDecimal } from './decimal';
import { normalizePricingStockCell, PRICING_STOCK_LIMITS } from './calculation';
import { pricingStockValidationIssues } from './formula';
import { pricingStockIssue, type PricingStockValues } from './types';
import type { PricingStockBulkPreview } from './editing';
import type { PricingStockSizing } from './api';

export type PricingStockColumnField = 'inventory' | 'purchaseNet' | 'saleNet' | 'workMinutes';
export type PricingStockColumnMode = 'copy' | 'proportional';
export type PricingStockColumnSource = PricingStockValues & { variantId: number; itemId: number; unit: string; sizing?: PricingStockSizing };
export type PricingStockColumnPreview = Omit<PricingStockBulkPreview, 'rows'> & {
  sourceVariantId: number;
  targetCount: number;
  rows: Array<PricingStockBulkPreview['rows'][number] & { basis: 'copy' | 'volume' | 'weight'; ratio: { numerator: string; denominator: string } }>;
  skipped: Array<{ variantId: number; code: string; message: string }>;
};
const fields: readonly PricingStockColumnField[] = ['inventory','purchaseNet','saleNet','workMinutes'];
const normalized = (value: string | null | undefined) => value?.trim().normalize('NFC').toLocaleLowerCase('sl-SI') ?? '';
const pieceUnits = new Set(['kos','kom','pcs','pc','piece','pak','paket','pack','set']);
function positiveMeasurement(value: string | null, field: string, owner: 'source' | 'target'): ExactDecimal {
  const labels: Record<string,string> = {lengthMm:'Dolžina',widthMm:'Širina',thicknessMm:'Debelina',weightKg:'Masa'};
  const label = labels[field] + (owner === 'source' ? ' izvorne različice' : ' ciljne različice');
  if (value === null) throw pricingStockIssue(field, 'MEASUREMENT_MISSING', label + ' ni določena.');
  let parsed: ExactDecimal;
  try { parsed = parseExactDecimal(value, field); }
  catch { throw pricingStockIssue(field, 'MEASUREMENT_INVALID', label + ' ni veljavno pozitivno število.'); }
  if (compareExact(parsed, EXACT_ZERO) <= 0) throw pricingStockIssue(field, 'MEASUREMENT_INVALID', label + ' mora biti večja od nič.');
  return parsed;
}
function measures(sizing: PricingStockSizing, owner: 'source' | 'target'): ExactDecimal[] {
  // Same complete-positive-volume rule as Prodaja/applyProportionalVariantWeights.
  // Money/time ratios stay exact instead of using its float/whole-gram boundary.
  if (sizing.productType === 'dimensions') return [
    positiveMeasurement(sizing.lengthMm, 'lengthMm', owner), positiveMeasurement(sizing.widthMm, 'widthMm', owner), positiveMeasurement(sizing.thicknessMm, 'thicknessMm', owner)
  ];
  return [positiveMeasurement(sizing.weightKg, 'weightKg', owner)];
}
function compatibility(source: PricingStockColumnSource, target: PricingStockColumnSource): { basis: 'volume' | 'weight'; ratio: ExactDecimal } {
  if (!Number.isSafeInteger(source.itemId) || source.itemId <= 0 || !Number.isSafeInteger(target.itemId) || target.itemId <= 0) throw pricingStockIssue('sizing', 'PRODUCT_IDENTITY_MISSING', 'Manjka zanesljiva povezava različice z artiklom.');
  if (source.itemId !== target.itemId) throw pricingStockIssue('sizing', 'DIFFERENT_PRODUCT', 'Različica pripada drugemu artiklu; podobnosti ne sklepamo samo iz mer.');
  const left = source.sizing, right = target.sizing;
  if (!left || !right || !left.productType || !right.productType) throw pricingStockIssue('sizing', 'SIZING_MISSING', 'Manjkajo zanesljivi podatki o vrsti produkta in merah.');
  if (left.productType !== right.productType || !['dimensions','weight'].includes(left.productType)) throw pricingStockIssue('sizing', 'PRODUCT_TYPE_INCOMPATIBLE', 'Sorazmerni izračun je mogoč med različicami istega dimenzijskega ali masnega produkta.');
  if (normalized(left.shape) !== normalized(right.shape) || normalized(left.material) !== normalized(right.material)) throw pricingStockIssue('sizing', 'PRODUCT_PROPERTIES_DIFFER', 'Oblika ali material različic se razlikujeta.');
  if (!normalized(source.unit) || normalized(source.unit) !== normalized(target.unit)) throw pricingStockIssue('sizing', 'UNIT_INCOMPATIBLE', 'Prodajni enoti se razlikujeta ali nista določeni.');
  if (!pieceUnits.has(normalized(source.unit))) throw pricingStockIssue('sizing', 'UNIT_ALREADY_NORMALIZED', 'Cena ali čas na kg, meter ali drugo mersko enoto se ne množi še z velikostjo paketa. Uporabite kopiranje ali ročni vnos.');
  const sourceMeasures = measures(left, 'source'), targetMeasures = measures(right, 'target');
  const ratio = sourceMeasures.reduce((result, sourceMeasure, index) => multiplyExact(result, divideExact(targetMeasures[index], sourceMeasure)), EXACT_ONE);
  return { basis: left.productType === 'dimensions' ? 'volume' : 'weight', ratio };
}
/** Pure proposal. Targets are exactly the caller's filtered set; never fetch/expand it. */
export function previewPricingStockColumn(
  source: PricingStockColumnSource, targets: readonly PricingStockColumnSource[], field: PricingStockColumnField, mode: PricingStockColumnMode
): PricingStockColumnPreview {
  const preview: PricingStockColumnPreview = {
    sourceVariantId: source.variantId, targetCount: new Set(targets.filter(target => target.variantId !== source.variantId).map(target => target.variantId)).size,
    rows: [], errors: [], skipped: [], rounding: 'half-away-from-zero', decimalPlaces: field === 'inventory' ? 0 : field === 'workMinutes' ? 4 : 2
  };
  let sourceValue: string;
  try {
    if (!fields.includes(field) || !['copy','proportional'].includes(mode) || (field === 'inventory' && mode === 'proportional')) throw pricingStockIssue('column', 'UNSUPPORTED_COLUMN_ACTION', 'Sorazmerno lahko uporabite le nabavno ceno, prodajno ceno ali čas dela.');
    if (!Number.isSafeInteger(source.variantId) || source.variantId <= 0) throw pricingStockIssue('source', 'SOURCE_REQUIRED', 'Izberite natanko eno izvorno različico.');
    const rawValue = field === 'inventory' ? String(source.inventory) : source[field];
    if (rawValue === null) throw pricingStockIssue(field, 'SOURCE_VALUE_MISSING', 'Izvorna vrednost ni znana; ne kopiramo je in je ne pretvarjamo v nič.');
    const normalizedValue = normalizePricingStockCell(field, rawValue);
    if (normalizedValue === null) throw pricingStockIssue(field, 'SOURCE_VALUE_MISSING', 'Izvorna vrednost ni znana; ne kopiramo je in je ne pretvarjamo v nič.');
    sourceValue = normalizedValue;
  } catch (error) {
    preview.errors.push(...pricingStockValidationIssues(error).map(issue => ({ ...issue, variantId: source.variantId })));
    return preview;
  }
  const seen = new Set<number>();
  for (const target of targets) {
    if (target.variantId === source.variantId) continue;
    try {
      if (!Number.isSafeInteger(target.variantId) || target.variantId <= 0 || seen.has(target.variantId)) throw pricingStockIssue('variantId', 'DUPLICATE_OR_INVALID_VARIANT', 'Ciljna različica je neveljavna ali podvojena.');
      seen.add(target.variantId);
      let basis: 'copy' | 'volume' | 'weight' = 'copy', ratio = EXACT_ONE;
      let proposed: string | null = sourceValue;
      if (mode === 'proportional') {
        try {
          ({ basis, ratio } = compatibility(source, target));
        } catch (error) {
          preview.skipped.push(...pricingStockValidationIssues(error).map(issue => ({ variantId: target.variantId, code: issue.code, message: issue.message })));
          continue;
        }
        const exact = multiplyExact(parseExactDecimal(sourceValue, field), ratio);
        const maximum = field === 'workMinutes' ? PRICING_STOCK_LIMITS.workMinutes : PRICING_STOCK_LIMITS.money;
        if (compareExact(exact, parseExactDecimal(maximum)) > 0) throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Sorazmerna vrednost presega dovoljeno velikost.');
        proposed = normalizePricingStockCell(field, formatExactDecimal(exact, preview.decimalPlaces));
      }
      const previous = field === 'inventory' ? String(target.inventory) : target[field];
      const changed = proposed === null || previous === null ? proposed !== previous : compareExact(parseExactDecimal(proposed), parseExactDecimal(previous)) !== 0;
      preview.rows.push({ variantId: target.variantId, field, previous, proposed, changed, basis, ratio: { numerator: ratio.numerator.toString(), denominator: ratio.denominator.toString() } });
    } catch (error) {
      preview.errors.push(...pricingStockValidationIssues(error).map(issue => ({ ...issue, variantId: target.variantId })));
    }
  }
  return preview;
}
