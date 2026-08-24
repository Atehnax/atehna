import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_QUANTITY_DISCOUNT_TARGET,
  getBestQuantityDiscount,
  parseQuantityDiscountRules,
  parseQuantityDiscountTargets,
  resolveEffectiveOrderDiscount
} from '../../src/shared/server/orderQuantityDiscount';

const universalTargets = JSON.stringify({
  variants: [ALL_QUANTITY_DISCOUNT_TARGET],
  customers: [ALL_QUANTITY_DISCOUNT_TARGET]
});

test('quantity discount targets accept only the canonical scoped JSON representation', () => {
  assert.deepEqual(parseQuantityDiscountTargets(universalTargets), {
    variantTargets: [ALL_QUANTITY_DISCOUNT_TARGET],
    customerTargets: [ALL_QUANTITY_DISCOUNT_TARGET]
  });
  assert.deepEqual(
    parseQuantityDiscountTargets(
      JSON.stringify({
        variants: [' MAT-001 ', 'mat-001'],
        customers: [' Šola Center ', 'šola center']
      })
    ),
    {
      variantTargets: ['MAT-001'],
      customerTargets: ['Šola Center']
    }
  );
  assert.deepEqual(parseQuantityDiscountTargets('allVariants'), {
    variantTargets: [],
    customerTargets: []
  });
  assert.deepEqual(parseQuantityDiscountTargets('{not-json'), {
    variantTargets: [],
    customerTargets: []
  });
  assert.deepEqual(parseQuantityDiscountRules('not-json'), []);
  assert.deepEqual(
    parseQuantityDiscountRules([
      { minQuantity: 0, discountPercent: 5, appliesTo: universalTargets },
      { minQuantity: 10, discountPercent: 101, appliesTo: universalTargets },
      { minQuantity: 10, discountPercent: 5, appliesTo: 'allVariants' }
    ]),
    []
  );
});

test('best quantity discount matches variant and customer labels case-insensitively', () => {
  const rules = [
    { minQuantity: 10, discountPercent: 5, appliesTo: universalTargets },
    {
      minQuantity: 25,
      discountPercent: 8,
      appliesTo: JSON.stringify({
        variants: ['MAT-001'],
        customers: ['Šola Center']
      })
    },
    {
      minQuantity: 25,
      discountPercent: 9,
      appliesTo: JSON.stringify({
        variants: ['mat-001'],
        customers: ['šola center']
      })
    },
    { minQuantity: 50, discountPercent: 20, appliesTo: universalTargets }
  ];

  const best = getBestQuantityDiscount(rules, {
    quantity: 30,
    sku: 'Mat-001',
    variantName: '0,3 × 100 × 100 mm',
    customerLabels: ['ŠOLA CENTER'],
    productType: 'dimensions'
  });
  assert.equal(best?.minQuantity, 25);
  assert.equal(best?.discountPercent, 9);

  const universalFallback = getBestQuantityDiscount(rules, {
    quantity: 30,
    sku: 'MAT-001',
    variantName: '0,3 × 100 × 100 mm',
    customerLabels: ['Drug naročnik'],
    productType: 'dimensions'
  });
  assert.equal(universalFallback?.discountPercent, 5);
});

test('quantity discount can target the displayed variant label and is disabled for machines', () => {
  const rules = [
    {
      minQuantity: 2,
      discountPercent: 4,
      appliesTo: JSON.stringify({
        variants: ['100 × 100 MM'],
        customers: ['VSE']
      })
    }
  ];
  const context = {
    quantity: 2,
    sku: 'MAT-OTHER',
    variantName: 'Plošča 100 × 100 mm',
    customerLabels: [] as string[],
    productType: 'dimensions'
  };

  assert.equal(getBestQuantityDiscount(rules, context)?.discountPercent, 4);
  assert.equal(
    getBestQuantityDiscount(rules, {
      ...context,
      productType: 'unique_machine'
    }),
    null
  );
});

test('effective discount never stacks and quantity wins an equal-percentage tie', () => {
  const quantityRule = {
    minQuantity: 10,
    discountPercent: 5,
    variantTargets: [ALL_QUANTITY_DISCOUNT_TARGET],
    customerTargets: [ALL_QUANTITY_DISCOUNT_TARGET]
  };

  assert.deepEqual(resolveEffectiveOrderDiscount(10, quantityRule), {
    discountKind: 'variant',
    discountPct: 10,
    quantityDiscountPct: 5
  });
  assert.deepEqual(resolveEffectiveOrderDiscount(5, quantityRule), {
    discountKind: 'quantity',
    discountPct: 5,
    quantityDiscountPct: 5
  });
  assert.deepEqual(resolveEffectiveOrderDiscount(0, null), {
    discountKind: null,
    discountPct: 0,
    quantityDiscountPct: null
  });
});
