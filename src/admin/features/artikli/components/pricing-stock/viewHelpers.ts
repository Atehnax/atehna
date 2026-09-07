import type { PricingStockRow } from '@/shared/domain/pricingStock/api';
import { formatExactDecimal, parseExactDecimal } from '@/shared/domain/pricingStock/decimal';
import { compilePricingStockFormula, type PricingStockModel, type PricingStockValues } from '@/shared/domain/pricingStock';
export type EditableField = keyof PricingStockValues;
export const EDITABLE_FIELDS: EditableField[] = ['inventory','purchaseNet','saleNet','workMinutes','otherCosts'];
export const fieldLabels: Record<EditableField,string> = { inventory:'Zaloga',purchaseNet:'Nabavna cena',saleNet:'Prodajna cena',workMinutes:'Delo / kos',otherCosts:'Drugi stroški' };
export const decimalText = (value: string | number | null | undefined) => value === null || value === undefined ? '' : String(value).replace('.', ',');
/** Presentation only: canonical minutes and calculations retain their existing precision. */
export function workMinutesText(value: string | number | null | undefined): string {
  const raw = decimalText(value);
  if (!raw.trim()) return '';
  try { return formatExactDecimal(parseExactDecimal(raw), 0); }
  catch { return raw; }
}

export function workMinutesTitle(value: string | number | null | undefined): string {
  const description = 'Delovne minute vseh sodelujočih na eno prodajno enoto.';
  const raw = decimalText(value);
  if (!raw.trim()) return description;
  try {
    const exact = parseExactDecimal(raw);
    if (exact.numerator % exact.denominator === 0n) return description;
    const minutes = decimalText(formatExactDecimal(exact, 4).replace(/0+$/u, '').replace(/\.$/u, ''));
    return `${description} Prikaz je zaokrožen na cele minute; izračun uporablja ${minutes} min.`;
  } catch { return description; }
}

export const money = (value: string | null | undefined) => value === null || value === undefined ? '—' : decimalText(value) + ' €';
export const percent = (value: string | null | undefined) => value === null || value === undefined ? '—' : decimalText(value) + ' %';
export const rowLabel = (row: PricingStockRow) => row.itemName + (row.variantName && row.variantName !== row.itemName ? ' · ' + row.variantName : '');
export const valuesOf = (row: PricingStockValues): PricingStockValues => ({inventory:row.inventory,purchaseNet:row.purchaseNet,saleNet:row.saleNet,workMinutes:row.workMinutes,otherCosts:row.otherCosts});
export const timestamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString('sl-SI', {dateStyle:'short',timeStyle:'short'}) : 'Ni podatka';
export function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Spremembe ni mogoče uporabiti.'; }

/** Only inputs referenced by the active formula can block its target preview. */
export function getMissingFormulaFields(values: PricingStockValues, model: PricingStockModel): EditableField[] {
  const fields: Record<string, EditableField> = {
    'čas_artikla_v_minutah': 'workMinutes',
    'drugi_spremenljivi_stroški_artikla': 'otherCosts',
    'nabavna_cena': 'purchaseNet',
    'prodajna_cena': 'saleNet'
  };
  try {
    return compilePricingStockFormula(model.formula).variables.flatMap(variable => {
      const field = fields[variable];
      return field && values[field] === null ? [field] : [];
    });
  } catch {
    return [];
  }
}
