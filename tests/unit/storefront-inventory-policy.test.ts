import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  isStorefrontVariantPurchasable,
  type StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const variant = (
  overrides: Partial<StorefrontVariant> = {}
): StorefrontVariant => ({
  id: 'variant-1',
  commerceId: 1,
  position: 0,
  name: 'Različica',
  sku: 'SKU-1',
  optionValueIds: [],
  baseUnitNet: 10,
  discountPct: 0,
  unitNet: 10,
  taxRate: 0.22,
  inventory: 0,
  minOrder: 3,
  unit: 'kos',
  status: 'active',
  attributes: {},
  mediaIds: [],
  specifications: [],
  includedItems: [],
  documents: [],
  ...overrides
});

test('disabled enforcement makes active catalog variants orderable regardless of stock', () => {
  assert.equal(isStorefrontVariantPurchasable(variant()), false);
  assert.equal(isStorefrontVariantPurchasable(variant(), false), true);
  assert.equal(
    isStorefrontVariantPurchasable(variant({ inventory: 2, minOrder: 3 })),
    false
  );
  assert.equal(
    isStorefrontVariantPurchasable(
      variant({ inventory: 2, minOrder: 3 }),
      false
    ),
    true
  );
  assert.equal(
    isStorefrontVariantPurchasable(variant({ inventory: null })),
    true
  );
});

test('disabled enforcement never revives inactive or unlinked variants', () => {
  assert.equal(
    isStorefrontVariantPurchasable(variant({ status: 'inactive' }), false),
    false
  );
  assert.equal(
    isStorefrontVariantPurchasable(variant({ commerceId: null }), false),
    false
  );
  assert.equal(isStorefrontVariantPurchasable(null, false), false);
});

test('the public provider reaches every stock-sensitive client surface', () => {
  const rootLayout = source('src/commercial/shell/rootLayout.tsx');
  assert.match(rootLayout, /getInventoryPolicySettings\(\)/u);
  assert.match(
    rootLayout,
    /stockEnforcementEnabled=\{inventoryPolicy\.stockEnforcementEnabled\}/u
  );

  for (const path of [
    'src/commercial/components/storefront/Availability.tsx',
    'src/commercial/components/storefront/VariantSelector.tsx',
    'src/commercial/components/storefront/PurchasePanel.tsx',
    'src/commercial/components/storefront/ProductDetailView.tsx',
    'src/commercial/components/storefront/ProductCard.tsx',
    'src/commercial/components/storefront/CartLine.tsx',
    'src/commercial/features/cart/CartDrawer.tsx',
    'src/commercial/features/cart/CartPageClient.tsx',
    'src/commercial/order/components/OrderPageClient.tsx'
  ]) {
    assert.match(
      source(path),
      /useStockEnforcementEnabled/u,
      `${path} must consume the storefront stock policy`
    );
  }
});

test('manual-stock mode removes inventory caps while preserving minimum quantities', () => {
  const purchasePanel = source(
    'src/commercial/components/storefront/PurchasePanel.tsx'
  );
  const productCard = source(
    'src/commercial/components/storefront/ProductCard.tsx'
  );
  const cartLine = source(
    'src/commercial/components/storefront/CartLine.tsx'
  );

  assert.match(
    purchasePanel,
    /stockEnforcementEnabled && typeof variant\?\.inventory === 'number'/u
  );
  assert.match(purchasePanel, /const minimum = variant\?\.minOrder \?\? 1/u);
  assert.match(
    productCard,
    /stockEnforcementEnabled && typeof quickVariant\?\.inventory === 'number'/u
  );
  assert.match(cartLine, /const maximum =\s*stockEnforcementEnabled/u);
  assert.match(
    cartLine,
    /const normalized = Math\.max\(minimum, Math\.floor/u
  );
});

test('manual-stock mode suppresses out-of-stock presentation without hiding stock facts', () => {
  const availability = source(
    'src/commercial/components/storefront/Availability.tsx'
  );
  const selector = source(
    'src/commercial/components/storefront/VariantSelector.tsx'
  );

  assert.match(availability, /else if \(!stockEnforcementEnabled\)/u);
  assert.match(availability, /label = 'Na voljo za naročilo'/u);
  assert.match(availability, /Trenutna zaloga:/u);
  assert.match(
    selector,
    /isStorefrontVariantPurchasable\(variant, stockEnforcementEnabled\)/u
  );
});
