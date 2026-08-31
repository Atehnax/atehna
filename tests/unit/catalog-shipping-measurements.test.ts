import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import {
  buildMachineCatalogVariants,
  buildSimpleCatalogVariants,
  buildWeightCatalogVariants,
  defaultMachineProductData,
  defaultSimpleProductData,
  defaultWeightProductData
} from '@/admin/features/artikli/components/pricing/productData';
import { createVariant } from '@/admin/features/artikli/lib/familyModel';
import { deriveCatalogVariantShippingMeasurements } from '@/shared/domain/catalog/catalogShipping';

describe('catalog physical-measurement authority', () => {
  test('derives canonical shipping snapshots from variant kilograms and millimetres', () => {
    expect(deriveCatalogVariantShippingMeasurements({
      weight: 0.014,
      length: 100,
      width: 80,
      thickness: 0.5
    })).toEqual({
      shippingWeightGrams: 14,
      shippingLengthMm: 100,
      shippingWidthMm: 80,
      shippingHeightMm: 0.5
    });

    expect(deriveCatalogVariantShippingMeasurements({
      weight: 2.5,
      length: 620,
      width: 380,
      thickness: 330
    })).toEqual({
      shippingWeightGrams: 2500,
      shippingLengthMm: 620,
      shippingWidthMm: 380,
      shippingHeightMm: 330
    });
  });

  test('never guesses invalid, localized, fractional-gram, or incomplete physical values', () => {
    expect(deriveCatalogVariantShippingMeasurements({
      weight: 0.0145,
      length: 100,
      width: 80,
      thickness: 0.5
    }).shippingWeightGrams).toBeNull();

    expect(deriveCatalogVariantShippingMeasurements({
      weight: '0,014',
      length: '100',
      width: 80,
      thickness: 0.5
    })).toEqual({
      shippingWeightGrams: null,
      shippingLengthMm: null,
      shippingWidthMm: 80,
      shippingHeightMm: 0.5
    });

    expect(deriveCatalogVariantShippingMeasurements({
      weight: 0,
      length: -1,
      width: null,
      thickness: 0
    })).toEqual({
      shippingWeightGrams: null,
      shippingLengthMm: null,
      shippingWidthMm: null,
      shippingHeightMm: null
    });
  });

  test('simple Prodaja measurements map into its sole physical variant', () => {
    const [variant] = buildSimpleCatalogVariants({
      ...defaultSimpleProductData,
      weightGrams: 750,
      lengthMm: 400,
      widthMm: 250,
      thicknessMm: 120
    }, createVariant({
      id: 'simple-physical',
      sku: 'SIMPLE-PHYSICAL'
    }), 'SIMPLE-PHYSICAL', 'Enostavni artikel');

    expect(variant).toMatchObject({
      weight: 0.75,
      length: 400,
      width: 250,
      thickness: 120
    });
  });

  test('weight-product Neto masa and package axes map into physical variants', () => {
    const [variant] = buildWeightCatalogVariants({
      ...defaultWeightProductData,
      packagingChips: ['kg:2,5'],
      variants: [{
        id: 'weight-physical',
        sku: 'WEIGHT-PHYSICAL',
        fraction: '0-2 mm',
        color: '—',
        netMassKg: 2.5,
        lengthMm: 400,
        widthMm: 250,
        thicknessMm: 120,
        minQuantity: 1,
        unitPrice: 12,
        costNet: 8,
        discountPct: 0,
        stockKg: 100,
        tolerance: '',
        deliveryTime: '1-2 delovna dneva',
        active: true,
        noteTag: '',
        position: 1
      }]
    }, 'WEIGHT');

    expect(variant).toMatchObject({
      weight: 2.5,
      length: 400,
      width: 250,
      thickness: 120
    });
  });

  test('machine package properties replace stale generic physical values', () => {
    const [variant] = buildMachineCatalogVariants({
      ...defaultMachineProductData,
      packageWeightKg: 8.2,
      packageDimensions: '620 x 380 x 330 mm'
    }, createVariant({
      id: 'machine-physical',
      sku: 'MACHINE-PHYSICAL',
      weight: 99,
      length: 999,
      width: 998,
      thickness: 997
    }), 'MACHINE', 'Stroj');

    expect(variant).toMatchObject({
      weight: 8.2,
      length: 620,
      width: 380,
      thickness: 330
    });
  });

  test('clearing the structured machine package dimensions clears every generic axis', () => {
    const [variant] = buildMachineCatalogVariants({
      ...defaultMachineProductData,
      packageLengthMm: null,
      packageWidthMm: null,
      packageThicknessMm: null,
      packageDimensions: ''
    }, createVariant({
      length: 999,
      width: 998,
      thickness: 997
    }), 'MACHINE', 'Stroj');

    expect(variant).toMatchObject({
      length: null,
      width: null,
      thickness: null
    });
  });
});
