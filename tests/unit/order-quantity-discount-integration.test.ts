import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('authoritative quote loads scoped rules and uses the editor type for machine exclusion', () => {
  const commerceSource = source('src/shared/server/orderCommerce.ts');

  assert.match(commerceSource, /from catalog_item_quantity_discounts cqd/u);
  assert.match(commerceSource, /join catalog_item_editor_details cied on cied\.item_id = ci\.id/u);
  assert.doesNotMatch(commerceSource, /left join catalog_item_editor_details/u);
  assert.match(commerceSource, /cied\.product_type as editor_product_type/u);
  assert.match(commerceSource, /productType: row\.editor_product_type/u);
});

test('customer labels and discount provenance flow through both commercial quote paths', () => {
  const quoteRouteSource = source('src/commercial/api/orders/quote/route.ts');
  const orderRouteSource = source('src/commercial/api/orders/route.ts');
  const commerceSource = source('src/shared/server/orderCommerce.ts');

  assert.match(quoteRouteSource, /bodyResult\.body\.customerName/u);
  assert.match(quoteRouteSource, /customerLabels: customerName \? \[customerName\] : \[\]/u);
  assert.match(orderRouteSource, /customer\.organizationName/u);
  assert.match(orderRouteSource, /customer\.contactName/u);
  assert.match(orderRouteSource, /customer\.customerName/u);
  assert.match(commerceSource, /discountKind: effectiveDiscount\.discountKind/u);
  assert.match(commerceSource, /quantityDiscountPct: effectiveDiscount\.quantityDiscountPct/u);
});
