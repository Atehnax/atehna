import {
  divideExact, formatExactDecimal, multiplyExact, parseExactDecimal, subtractExact
} from '@/shared/domain/pricingStock/decimal';

const HUNDRED = parseExactDecimal('100');

/** Use the same half-up cent rounding as authoritative checkout pricing. */
export function getCatalogDiscountedUnitNet(price: number, discountPercent = 0): number {
  const base = Number.isFinite(price) ? Math.max(0, price) : 0;
  const discount = Number.isFinite(discountPercent) ? Math.max(0, Math.min(100, discountPercent)) : 0;
  return Number(formatExactDecimal(
    divideExact(
      multiplyExact(parseExactDecimal(base.toFixed(2)), subtractExact(HUNDRED, parseExactDecimal(discount.toFixed(2)))),
      HUNDRED
    ),
    2
  ));
}
