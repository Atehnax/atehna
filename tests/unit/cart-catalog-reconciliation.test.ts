import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { CartItem } from '@/commercial/cart/cartTypes';
import { useCartStore } from '@/commercial/cart/store';
import { buildCartEstimateErrorUpdates, buildCartEstimateUpdate } from '@/commercial/order/cartReconciliation';
import { parseOrderApiError, type OrderEstimateItem } from '@/commercial/order/contracts';
import { getDiscountedPrice } from '@/commercial/catalog/catalogUtils';
import { getCatalogDiscountedUnitNet } from '@/shared/domain/catalog/catalogPricing';

const existing: CartItem = {
  lineId: 'saved-line-id',
  sku: 'OLD-SKU',
  name: 'Stari naziv',
  productId: '42',
  productSlug: 'stari-naziv',
  productHref: '/products/materiali/items/stari-naziv',
  imageUrl: '/old-image.jpg',
  imageAlt: 'Stara slika',
  unit: 'kos',
  variant: { id: 101, name: 'Stara različica', sku: 'OLD-SKU', options: [] },
  quantity: 5,
  note: 'Uporabniška opomba',
  reconciliation: { status: 'unchecked', minOrder: 1, availableStock: 50 }
};
const estimate: OrderEstimateItem = {
  variantId: 101, productId: 42, productSlug: 'novi-naziv', productName: 'Novi naziv',
  variantName: '200 × 200 mm', sku: 'NEW-SKU', unit: 'plošča', quantity: 5,
  minOrder: 5, availableStock: 20, imageUrl: '/current-image.jpg', attributes: {},
  optionAssignments: [{ axisId: 7, axisName: 'Dimenzije', valueId: 8, value: '200 × 200 mm' }],
  baseUnitNet: 4.5, discountPct: 5, unitNet: 4.28, lineNet: 21.4, lineTax: 4.71,
  lineGross: 26.11, taxRate: 0.22
};
const checkedAt = '2026-09-12T12:00:00.000Z';

beforeEach(() => useCartStore.setState({ items: [] }));

test('an existing cart refreshes catalog content and limits without changing its identity or quantity', () => {
  useCartStore.setState({ items: [existing] });
  useCartStore.getState().reconcileItems([buildCartEstimateUpdate(existing, estimate, checkedAt)]);
  const result = useCartStore.getState().items[0];
  assert.equal(result.lineId, existing.lineId);
  assert.equal(result.quantity, existing.quantity);
  assert.equal(result.note, existing.note);
  assert.equal(result.name, 'Novi naziv');
  assert.equal(result.imageUrl, '/current-image.jpg');
  assert.equal(result.imageAlt, 'Novi naziv');
  assert.equal(result.sku, 'NEW-SKU');
  assert.equal(result.unit, 'plošča');
  assert.equal(result.productHref, '/products/materiali/items/novi-naziv');
  assert.equal(result.variant?.id, existing.variant?.id);
  assert.equal(result.variant?.name, '200 × 200 mm');
  assert.equal(result.variant?.options[0].valueLabel, '200 × 200 mm');
  assert.equal(result.reconciliation.minOrder, 5);
  assert.equal(result.reconciliation.availableStock, 20);
});

test('removing an image in the catalog removes its stale cart snapshot', () => {
  useCartStore.setState({ items: [existing] });
  useCartStore.getState().reconcileItems([
    buildCartEstimateUpdate(existing, { ...estimate, imageUrl: null }, checkedAt)
  ]);
  assert.equal(useCartStore.getState().items[0].imageUrl, undefined);
});

test('minimum-order errors carry the new limits back to the cart quantity control', () => {
  const error = parseOrderApiError({
    code: 'ORDER_ITEMS_UNAVAILABLE',
    message: 'Preverite količine.',
    issues: [{
      code: 'MINIMUM_ORDER_NOT_MET', message: 'Minimalna količina je 5.',
      variantId: 101, minOrder: 5, availableStock: 20
    }]
  });
  const update = buildCartEstimateErrorUpdates([existing], error, checkedAt)[0];
  assert.equal(update.reconciliation.minOrder, 5);
  assert.equal(update.reconciliation.availableStock, 20);
  assert.equal(update.reconciliation.status, 'unavailable');
  const generic = buildCartEstimateErrorUpdates([existing], { message: 'Poskusite znova.' }, checkedAt)[0];
  assert.equal(generic.reconciliation.minOrder, 1);
  assert.equal(generic.reconciliation.availableStock, 50);
});

test('editing quantity retains current catalog limits while waiting for the next estimate', () => {
  useCartStore.setState({ items: [{ ...existing, reconciliation: { status: 'valid', minOrder: 5, availableStock: 20 } }] });
  useCartStore.getState().setQuantity(existing.lineId, 6);
  const result = useCartStore.getState().items[0];
  assert.equal(result.quantity, 6);
  assert.deepEqual(result.reconciliation, { status: 'unchecked', minOrder: 5, availableStock: 20 });
});

test('storefront and admin discounted unit net use checkout half-up cent rounding', () => {
  assert.equal(getDiscountedPrice(4.5, 5), 4.28);
  assert.equal(getCatalogDiscountedUnitNet(4.5, 5), 4.28);
  assert.equal(Number((getDiscountedPrice(4.5, 5) * 1.22).toFixed(2)), 5.22);
  assert.equal(getDiscountedPrice(0.01, 50), 0.01);
  assert.equal(getDiscountedPrice(4.5, 0), 4.5);
});
