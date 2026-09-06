import type { PricingStockRow } from '@/shared/domain/pricingStock/api';
import type { PricingStockValues } from '@/shared/domain/pricingStock';
export type EditableField = keyof PricingStockValues;
export const EDITABLE_FIELDS: EditableField[] = ['inventory','purchaseNet','saleNet','workMinutes','otherCosts'];
export const fieldLabels: Record<EditableField,string> = { inventory:'Zaloga',purchaseNet:'Nabavna cena',saleNet:'Prodajna cena',workMinutes:'Delo / kos',otherCosts:'Drugi stroški' };
export const decimalText = (value: string | number | null | undefined) => value === null || value === undefined ? '' : String(value).replace('.', ',');
export const money = (value: string | null | undefined) => value === null || value === undefined ? '—' : decimalText(value) + ' €';
export const percent = (value: string | null | undefined) => value === null || value === undefined ? '—' : decimalText(value) + ' %';
export const rowLabel = (row: PricingStockRow) => row.itemName + (row.variantName && row.variantName !== row.itemName ? ' · ' + row.variantName : '');
export const valuesOf = (row: PricingStockValues): PricingStockValues => ({inventory:row.inventory,purchaseNet:row.purchaseNet,saleNet:row.saleNet,workMinutes:row.workMinutes,otherCosts:row.otherCosts});
export const timestamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString('sl-SI', {dateStyle:'short',timeStyle:'short'}) : 'Ni podatka';
export function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Spremembe ni mogoče uporabiti.'; }
