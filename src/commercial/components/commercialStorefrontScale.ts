export const COMMERCIAL_STOREFRONT_SCALE = 0.75;

export function toCommercialStorefrontLogicalPx(value: number) {
  return value / COMMERCIAL_STOREFRONT_SCALE;
}
