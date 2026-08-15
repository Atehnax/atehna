import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSimpleCatalogVariants,
  defaultSimpleProductData
} from '@/admin/features/artikli/components/pricing/productData';
import { toGrossWithTaxRate } from '@/admin/features/artikli/components/pricing/pricingCalculations';
import { createVariant } from '@/admin/features/artikli/lib/familyModel';

test('gross prices use the configured tax rate and accounting cent rounding', () => {
  expect(toGrossWithTaxRate(10, 0.22)).toBe(12.2);
  expect(toGrossWithTaxRate(0.05, 0.22)).toBe(0.06);
  expect(toGrossWithTaxRate(10, 0)).toBe(10);
  expect(toGrossWithTaxRate(10, 0.095)).toBe(10.95);
});

test('the simple product variant preserves its net purchase cost', () => {
  const fallback = createVariant({
    id: 'simple-variant',
    sku: 'SIMPLE-001',
    costNet: 4.25
  });

  const [variant] = buildSimpleCatalogVariants(
    { ...defaultSimpleProductData, basePrice: 10 },
    fallback,
    fallback.sku,
    'Enostavni artikel'
  );

  expect(variant.price).toBe(10);
  expect(variant.costNet).toBe(4.25);
});

test('the simple pricing table exposes purchase net, sale net and locked sale gross rows', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
    ),
    'utf8'
  );
  const purchaseIndex = source.indexOf("label: 'Nabavna cena brez DDV'");
  const saleNetIndex = source.indexOf("label: 'Prodajna cena brez DDV'", purchaseIndex);
  const saleGrossIndex = source.indexOf("label: 'Prodajna cena z DDV'", saleNetIndex);

  expect(purchaseIndex).toBeGreaterThan(-1);
  expect(saleNetIndex).toBeGreaterThan(purchaseIndex);
  expect(saleGrossIndex).toBeGreaterThan(saleNetIndex);
  expect(source.slice(saleGrossIndex, saleGrossIndex + 300)).toContain('locked: true');
});
