import type { QuantityDiscountDraft, SimulatorOption } from './pricingTypes';

export const defaultVatRate = 0.22;
export const defaultVatMultiplier = 1 + defaultVatRate;

export function toGrossWithVat(value: number): number {
  return Number((Math.max(0, value) * defaultVatMultiplier).toFixed(4));
}

export function toNetFromGross(value: number): number {
  return Number((Math.max(0, value) / defaultVatMultiplier).toFixed(4));
}

export function clampDiscountPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function getSimulatorOptionSku(option: Pick<SimulatorOption, 'id' | 'sku'>): string {
  return option.sku?.trim() || option.id;
}

export function discountRuleTargetsVariant(
  rule: Pick<QuantityDiscountDraft, 'variantTargets'>,
  option: Pick<SimulatorOption, 'id' | 'sku'>
): boolean {
  const targets = rule.variantTargets.length > 0 ? rule.variantTargets : ['Vse'];
  return targets.includes('Vse') || targets.includes(getSimulatorOptionSku(option));
}

export function discountRuleTargetsAllCustomers(
  rule: Pick<QuantityDiscountDraft, 'customerTargets'>
): boolean {
  const targets = rule.customerTargets.length > 0 ? rule.customerTargets : ['Vse'];
  return targets.includes('Vse');
}

export function getBestQuantityDiscount(
  rules: readonly QuantityDiscountDraft[],
  quantity: number,
  option: SimulatorOption
): QuantityDiscountDraft | null {
  return rules
    .filter(
      (rule) =>
        quantity >= rule.minQuantity &&
        discountRuleTargetsVariant(rule, option) &&
        discountRuleTargetsAllCustomers(rule)
    )
    .sort(
      (left, right) =>
        right.minQuantity - left.minQuantity || right.discountPercent - left.discountPercent
    )[0] ?? null;
}

export function getNextQuantityDiscount(
  rules: readonly QuantityDiscountDraft[],
  quantity: number,
  option: SimulatorOption
): QuantityDiscountDraft | null {
  return rules
    .filter(
      (rule) =>
        quantity < rule.minQuantity &&
        discountRuleTargetsVariant(rule, option) &&
        discountRuleTargetsAllCustomers(rule)
    )
    .sort(
      (left, right) =>
        left.minQuantity - right.minQuantity || right.discountPercent - left.discountPercent
    )[0] ?? null;
}

export function calculateDiscountedNetTotal(
  unitNetPrice: number,
  quantity: number,
  discountPercent: number
): number {
  const subtotal = Math.max(0, unitNetPrice) * Math.max(0, quantity);
  return Number((subtotal * (1 - clampDiscountPercent(discountPercent) / 100)).toFixed(4));
}

export function calculateGrossTotal(netTotal: number): number {
  return toGrossWithVat(netTotal);
}
