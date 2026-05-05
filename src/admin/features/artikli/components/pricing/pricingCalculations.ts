import type { PricingSimulatorOption, QuantityDiscountDraft } from './pricingTypes';
import { allDiscountTargetLabel, normalizeDiscountTargetList } from './productData';

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

export function getSimulatorOptionSku(option: Pick<PricingSimulatorOption, 'id' | 'label' | 'targetKey'>): string {
  if (option.targetKey?.trim()) return option.targetKey.trim();
  const match = option.label.match(/\(([^()]+)\)\s*$/);
  return match?.[1]?.trim() || option.id;
}

export function discountRuleTargetsVariant(
  rule: Pick<QuantityDiscountDraft, 'variantTargets'>,
  option: PricingSimulatorOption | null
): boolean {
  const targets = normalizeDiscountTargetList(rule.variantTargets);
  if (targets.includes(allDiscountTargetLabel) || !option) return true;
  const sku = getSimulatorOptionSku(option).toLocaleLowerCase('sl-SI');
  const label = option.label.toLocaleLowerCase('sl-SI');
  return targets.some((target) => {
    const normalized = target.toLocaleLowerCase('sl-SI');
    return normalized === sku || label.includes(normalized);
  });
}

export function discountRuleTargetsAllCustomers(
  rule: Pick<QuantityDiscountDraft, 'customerTargets'>
): boolean {
  return normalizeDiscountTargetList(rule.customerTargets).includes(allDiscountTargetLabel);
}

export function getBestQuantityDiscount(
  rules: readonly QuantityDiscountDraft[],
  quantity: number,
  option: PricingSimulatorOption | null
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
  option: PricingSimulatorOption | null
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
