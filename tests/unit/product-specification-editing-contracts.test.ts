import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import { computeCatalogItemAuditDiff } from '@/shared/audit/auditDiff';
import type { CatalogItemEditorVariantPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import {
  applyVariantPresentationPatch,
  validateAndNormalizeVariantPresentationPatches
} from '@/shared/domain/catalog/catalogVariantPresentationPatch';
import {
  migrateCatalogSpecificationKey,
  readCatalogSpecificationLabels,
  validateAndNormalizeCatalogAppearanceOverride,
  validateAndNormalizeCatalogSpecificationLabels,
  writeCatalogSpecificationLabels
} from '@/shared/domain/catalog/catalogSpecification';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import { buildStorefrontProductFromCatalogItem } from '@/commercial/features/products/storefrontProduct';
import {
  getStorefrontSpecificationOrderKey,
  prepareStorefrontSpecifications
} from '@/commercial/features/products/storefrontSpecifications';

const contractVariants: CatalogItemEditorVariantPayload[] = [
  {
    id: 11,
    variantName: 'Prva različica',
    variantSku: 'VAR-11',
    price: 12,
    length: 100,
    width: 80,
    thickness: 2,
    weight: 320,
    shippingWeightGrams: 320,
    shippingLengthMm: 110,
    shippingWidthMm: 90,
    shippingHeightMm: 5,
    contentOverride: {
      description: 'Opis različice',
      specifications: { Material: 'Aluminij' },
      attributes: { Barva: 'Srebrna' },
      includedItems: ['Navodila'],
      deliveryEstimate: '2 dni',
      documentIds: [7]
    }
  },
  {
    id: 12,
    variantName: 'Druga različica',
    variantSku: 'VAR-12',
    price: 14
  }
];

describe('product specification editing compatibility', () => {
  test('normalizes legacy dimension-editor kilograms before displaying grams', () => {
    const build = (productType: 'dimensions' | 'weight') => (
      buildStorefrontProductFromCatalogItem({
        id: productType === 'dimensions' ? 81 : 82,
        slug: `test-${productType}`,
        name: `Test ${productType}`,
        productType,
        status: 'active',
        defaultVariantId: productType === 'dimensions' ? 811 : 821,
        variants: [{
          id: productType === 'dimensions' ? 811 : 821,
          variantName: 'Privzeta',
          variantSku: `TEST-${productType}`,
          weight: productType === 'dimensions' ? 0.014 : 0.32,
          price: 10,
          inventory: 1,
          status: 'active'
        }]
      } as unknown as CatalogItem, {
        href: `/products/test-${productType}`,
        fallbackSku: 'TEST',
        fallbackPrice: 0,
        category: {
          slug: 'test',
          title: 'Test',
          href: '/products/test'
        }
      })
    );

    expect(build('dimensions').variants[0]?.attributes.Teža).toBe('14 g');
    expect(build('weight').variants[0]?.attributes.Teža).toBe('0.32 kg');
  });

  test('validates specification identity and variant ownership before persistence', () => {
    const normalizedDuplicate = validateAndNormalizeVariantPresentationPatches(
      [{
        variantId: 11,
        specifications: {
          'Površina': 'Brušena',
          'povrsina!': 'Polirana'
        }
      }],
      { variants: contractVariants }
    );
    expect(normalizedDuplicate).toEqual({
      ok: false,
      message: 'Nazivi specifikacij morajo biti enolični.'
    });

    const duplicateVariant = validateAndNormalizeVariantPresentationPatches(
      [
        { variantId: 11, specifications: { Material: 'Aluminij' } },
        { variantId: 11, specifications: { Barva: 'Srebrna' } }
      ],
      { variants: contractVariants }
    );
    expect(duplicateVariant).toEqual({
      ok: false,
      message: 'Ista različica je bila poslana večkrat.'
    });

    const foreignVariant = validateAndNormalizeVariantPresentationPatches(
      [{ variantId: 999, specifications: { Material: 'Aluminij' } }],
      { variants: contractVariants }
    );
    expect(foreignVariant).toEqual({
      ok: false,
      message: 'Izbrana različica ne pripada temu artiklu.'
    });
  });

  test('normalizes ordered rows and applies them without losing article-editor fields', () => {
    const validation = validateAndNormalizeVariantPresentationPatches(
      [{
        variantId: 11,
        specifications: {
          '  Obdelava  ': '  Brušena  ',
          Trdota: '  95 HB '
        },
        thickness: 2.5,
        errorTolerance: '  ±0,2 mm  ',
        variantSku: '  VAR-11-NOV  '
      }],
      { variants: contractVariants }
    );
    expect(validation.ok).toBe(true);
    if (!validation.ok || !validation.value) return;

    const patch = validation.value[0];
    expect(Object.entries(patch.specifications)).toEqual([
      ['Obdelava', 'Brušena'],
      ['Trdota', '95 HB']
    ]);
    const applied = applyVariantPresentationPatch(contractVariants[0], patch);
    expect(applied).toMatchObject({
      id: 11,
      variantName: 'Prva različica',
      variantSku: 'VAR-11-NOV',
      price: 12,
      length: 100,
      width: 80,
      thickness: 2.5,
      weight: 320,
      shippingWeightGrams: 320,
      shippingLengthMm: 110,
      shippingWidthMm: 90,
      shippingHeightMm: 5,
      errorTolerance: '±0,2 mm',
      contentOverride: {
        description: 'Opis različice',
        specifications: {
          Obdelava: 'Brušena',
          Trdota: '95 HB'
        },
        attributes: { Barva: 'Srebrna' },
        includedItems: ['Navodila'],
        deliveryEstimate: '2 dni',
        documentIds: [7]
      }
    });
    expect(contractVariants[0].contentOverride?.specifications).toEqual({
      Material: 'Aluminij'
    });

    const cleared = applyVariantPresentationPatch(applied, {
      variantId: 11,
      specifications: {}
    });
    expect(cleared.contentOverride).toEqual({
      description: 'Opis različice',
      attributes: { Barva: 'Srebrna' },
      includedItems: ['Navodila'],
      deliveryEstimate: '2 dni',
      documentIds: [7]
    });
  });

  test('renames only specification presentation while preserving values and stable order keys', () => {
    const sourceSpecifications = [
      {
        id: 'material',
        label: 'Material',
        value: 'Aluminij',
        orderKey: 'material'
      },
      {
        id: 'color',
        label: 'Barva',
        value: 'Srebrna',
        orderKey: 'barva'
      },
      {
        id: 'finish',
        label: 'Obdelava',
        value: 'Brušena',
        orderKey: 'obdelava'
      }
    ];
    const specificationOrder = ['barva', 'material', 'obdelava'];
    const before = prepareStorefrontSpecifications(
      sourceSpecifications,
      specificationOrder
    );
    const renamed = prepareStorefrontSpecifications(
      sourceSpecifications,
      specificationOrder,
      { material: 'Sestava' }
    );

    expect(renamed.map(getStorefrontSpecificationOrderKey)).toEqual(
      before.map(getStorefrontSpecificationOrderKey)
    );
    expect(renamed.map((entry) => entry.value)).toEqual(
      before.map((entry) => entry.value)
    );
    expect(renamed.map((entry) => entry.label)).toEqual([
      'Barva',
      'Sestava',
      'Obdelava'
    ]);

    const appearanceOverride = {
      relatedProducts: { enabled: false },
      secondaryContent: {
        specificationOrder,
        tabs: ['description', 'specifications']
      }
    };
    const written = writeCatalogSpecificationLabels(
      appearanceOverride,
      { material: '  Sestava  ' }
    );
    expect(readCatalogSpecificationLabels(written)).toEqual({
      material: 'Sestava'
    });
    expect(written).toMatchObject(appearanceOverride);

    const cleared = writeCatalogSpecificationLabels(written, {});
    expect(readCatalogSpecificationLabels(cleared)).toEqual({});
    expect(cleared).toEqual(appearanceOverride);

    const migrated = migrateCatalogSpecificationKey(
      specificationOrder,
      { obdelava: 'Končna obdelava' },
      'Obdelava',
      'Površinska obdelava'
    );
    expect(migrated).toEqual({
      specificationOrder: ['barva', 'material', 'povrsinska-obdelava'],
      specificationLabels: {
        'povrsinska-obdelava': 'Končna obdelava'
      }
    });

    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: '  Sestava  ',
      Barva: 'Odtenek'
    })).toEqual({
      ok: true,
      value: { material: 'Sestava', barva: 'Odtenek' }
    });
    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: 'Sestava',
      Barva: 'séstava!'
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });
    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: 'Barva'
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });

    expect(validateAndNormalizeCatalogAppearanceOverride({
      relatedProducts: { enabled: false },
      secondaryContent: {
        specificationOrder,
        specificationLabels: { Material: '  Sestava  ' }
      }
    })).toEqual({
      ok: true,
      value: {
        relatedProducts: { enabled: false },
        secondaryContent: {
          specificationOrder,
          specificationLabels: { material: 'Sestava' }
        }
      }
    });
    expect(validateAndNormalizeCatalogAppearanceOverride({
      secondaryContent: {
        specificationOrder,
        specificationLabels: { Material: 'Barva' }
      }
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });
  });

  test('a specification-only variant change is represented in the item audit diff', () => {
    const before = {
      variants: [{
        id: 17,
        variantSku: 'SPEC-17',
        variantName: 'Privzeta različica',
        contentOverride: {
          description: 'Opis ostane nespremenjen.',
          specifications: {
            Material: 'Aluminij',
            Površina: 'Brušena'
          },
          includedItems: ['Navodila']
        }
      }]
    };
    const after = structuredClone(before);
    after.variants[0].contentOverride.specifications.Površina = 'Polirana';

    const diff = computeCatalogItemAuditDiff(before, after);

    expect(diff).toHaveProperty('variants');
    expect(diff.variants).toMatchObject({
      updated: [{
        id: 'SPEC-17',
        changes: {
          specifications: expect.objectContaining({
            label: 'Specifikacije',
            before: expect.any(String),
            after: expect.any(String)
          })
        }
      }]
    });
  });
});
