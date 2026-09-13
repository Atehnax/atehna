import type { CartItem, CartReconciliationUpdate } from '@/commercial/cart/cartTypes';
import type { OrderApiError, OrderEstimateItem } from '@/commercial/order/contracts';

export function buildCartEstimateUpdate(
  item: CartItem,
  estimate: OrderEstimateItem,
  checkedAt: string
): CartReconciliationUpdate {
  const estimatedUnitGross = estimate.quantity > 0 ? estimate.lineGross / estimate.quantity : 0;
  const previousGross = item.pricing?.quotedUnitGross;
  const priceChanged = typeof previousGross === 'number'
    && Math.abs(previousGross - estimatedUnitGross) > 0.005;
  const productHref = item.productHref?.replace(
    /\/items\/[^/?#]+(?=[?#]|$)/u,
    () => '/items/' + encodeURIComponent(estimate.productSlug)
  );
  return {
    lineId: item.lineId,
    catalog: {
      sku: estimate.sku,
      name: estimate.productName,
      productId: String(estimate.productId),
      productSlug: estimate.productSlug,
      productHref,
      imageUrl: estimate.imageUrl ?? undefined,
      imageAlt: estimate.productName,
      unit: estimate.unit ?? undefined,
      variant: {
        id: estimate.variantId,
        name: estimate.variantName,
        sku: estimate.sku,
        options: estimate.optionAssignments?.map((option) => ({
          axisId: String(option.axisId),
          axisName: option.axisName,
          valueId: String(option.valueId),
          valueLabel: option.value
        })) ?? item.variant?.options ?? []
      }
    },
    pricing: {
      currency: 'EUR',
      taxRate: estimate.taxRate,
      baseUnitNet: estimate.baseUnitNet,
      discountPct: estimate.discountPct,
      unitNet: estimate.unitNet,
      estimatedUnitGross,
      quotedUnitGross: estimatedUnitGross,
      quotedAt: checkedAt
    },
    reconciliation: {
      status: priceChanged ? 'price_changed' : 'valid',
      message: priceChanged ? 'Cena je bila posodobljena po veljavnem ceniku.' : undefined,
      checkedAt,
      availableStock: estimate.availableStock,
      minOrder: estimate.minOrder
    }
  };
}

export function buildCartEstimateErrorUpdates(
  items: CartItem[],
  error: OrderApiError,
  checkedAt: string
): CartReconciliationUpdate[] {
  const issueByVariant = new Map(
    (error.issues ?? [])
      .filter((issue) => typeof issue.variantId === 'number')
      .map((issue) => [issue.variantId, issue])
  );
  return items.map((item) => {
    const issue = issueByVariant.get(item.variant?.id ?? undefined);
    return {
      lineId: item.lineId,
      reconciliation: {
        status: issue ? 'unavailable' : 'needs_review',
        message: issue?.message ?? error.message,
        checkedAt,
        minOrder: issue?.minOrder ?? item.reconciliation.minOrder,
        availableStock: issue?.availableStock ?? item.reconciliation.availableStock
      }
    };
  });
}
