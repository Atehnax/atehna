export type CartOptionSelection = {
  axisId: string;
  axisName: string;
  valueId: string;
  valueLabel: string;
};

export type CartVariantSnapshot = {
  id: number | null;
  name: string;
  sku: string;
  options: CartOptionSelection[];
};

export type CartPricingSnapshot = {
  currency: 'EUR';
  taxRate: number;
  baseUnitNet: number;
  discountPct: number;
  unitNet: number;
  estimatedUnitGross: number;
  quotedUnitGross?: number;
  quotedAt?: string;
};

export type CartReconciliationStatus =
  | 'unchecked'
  | 'valid'
  | 'price_changed'
  | 'quantity_adjusted'
  | 'unavailable'
  | 'needs_review';

export type CartReconciliation = {
  status: CartReconciliationStatus;
  message?: string;
  checkedAt?: string;
  availableStock?: number | null;
  minOrder?: number;
};

export type CartItem = {
  lineId: string;
  sku: string;
  name: string;
  productId?: string;
  productSlug?: string;
  productHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  variant?: CartVariantSnapshot;
  unit?: string;
  unitPrice?: number | null;
  pricing?: CartPricingSnapshot;
  quantity: number;
  category?: string;
  note?: string;
  reconciliation: CartReconciliation;
};

export type AddCartItemInput = Omit<CartItem, 'lineId' | 'quantity' | 'reconciliation'> & {
  lineId?: string;
  quantity?: number;
  reconciliation?: CartReconciliation;
};

const normalizeCartLineCopy = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('sl');

export function getDistinctCartVariantName(
  item: Pick<CartItem, 'name' | 'variant'>
) {
  const variantName = item.variant?.name.trim();
  if (!variantName) return null;

  const normalizedVariantName = normalizeCartLineCopy(variantName);
  if (normalizedVariantName === normalizeCartLineCopy(item.name)) return null;

  const optionValues = (item.variant?.options ?? []).map((option) =>
    normalizeCartLineCopy(option.valueLabel)
  );
  if (optionValues.includes(normalizedVariantName)) return null;

  return variantName;
}

export type CartReconciliationUpdate = {
  lineId: string;
  reconciliation: CartReconciliation;
  pricing?: Partial<CartPricingSnapshot>;
  quantity?: number;
};

const safeSegment = (value: string | number | null | undefined) =>
  encodeURIComponent(String(value ?? '').trim().toLocaleLowerCase('sl'));

export function createCartLineId(item: {
  sku: string;
  productId?: string;
  variant?: CartVariantSnapshot;
}) {
  const productIdentity = item.productId || item.sku;
  const variantIdentity = item.variant?.id ?? item.variant?.sku ?? item.sku;
  const optionIdentity =
    item.variant?.options
      .map((option) => `${safeSegment(option.axisId)}:${safeSegment(option.valueId)}`)
      .sort()
      .join('|') ?? '';
  return `${safeSegment(productIdentity)}::${safeSegment(variantIdentity)}::${optionIdentity}`;
}

export function getCartItemUnitGross(item: CartItem) {
  if (typeof item.pricing?.quotedUnitGross === 'number') {
    return item.pricing.quotedUnitGross;
  }
  if (typeof item.pricing?.estimatedUnitGross === 'number') {
    return item.pricing.estimatedUnitGross;
  }
  // A current quote is required before a price can be displayed or submitted.
  return null;
}

export function getCartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => {
    const unitGross = getCartItemUnitGross(item);
    return unitGross === null ? sum : sum + unitGross * item.quantity;
  }, 0);
}

export function cartHasBlockingIssue(items: CartItem[]) {
  return items.some(
    (item) =>
      item.variant?.id === null ||
      item.variant === undefined ||
      item.reconciliation.status === 'unavailable' ||
      item.reconciliation.status === 'needs_review'
  );
}
