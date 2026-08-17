import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import { getDistinctCartVariantName } from '@/commercial/cart/cartTypes';

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
