import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import {
  cartHasBlockingIssue,
  cartNeedsEstimate,
  getDistinctCartVariantName,
  type CartItem
} from '@/commercial/cart/cartTypes';

describe('cart-line copy de-duplication', () => {
  test('omits a variant name already represented by a labelled option', () => {
    expect(
      getDistinctCartVariantName({
        name: 'Aluminijasta plošča',
        variant: {
          id: 1,
          name: '0,3 × 100 × 100 mm',
          sku: 'MAT-KO',
          options: [
            {
              axisId: 'dimensions',
              axisName: 'Dimenzije',
              valueId: '0.3x100x100',
              valueLabel: '0,3 × 100 × 100 mm'
            }
          ]
        }
      })
    ).toBeNull();
  });

  test('omits a variant name that repeats the product name', () => {
    expect(
      getDistinctCartVariantName({
        name: 'Električni motorček R20',
        variant: {
          id: 2,
          name: 'Električni motorček R20',
          sku: 'EL-MOTOR',
          options: []
        }
      })
    ).toBeNull();
  });

  test('keeps a distinct variant name alongside structured options', () => {
    expect(
      getDistinctCartVariantName({
        name: 'Napajalnik',
        variant: {
          id: 3,
          name: 'Laboratorijska izvedba',
          sku: 'NAP-12',
          options: [
            {
              axisId: 'voltage',
              axisName: 'Napetost',
              valueId: '12v',
              valueLabel: '12 V'
            }
          ]
        }
      })
    ).toBe('Laboratorijska izvedba');
  });
});

describe('cart checkout safety', () => {
  const item = {
    lineId: 'line-1',
    sku: 'SKU-1',
    name: 'Artikel',
    quantity: 5,
    variant: {
      id: 1,
      name: 'Različica',
      sku: 'SKU-1',
      options: []
    },
    reconciliation: { status: 'valid' }
  } satisfies CartItem;

  test('blocks checkout while a changed quantity still awaits estimation', () => {
    expect(cartHasBlockingIssue([item])).toBe(false);
    const uncheckedItems = [
      { ...item, reconciliation: { status: 'unchecked' as const } }
    ];
    expect(cartHasBlockingIssue(uncheckedItems)).toBe(false);
    expect(cartNeedsEstimate(uncheckedItems)).toBe(true);
  });
});
