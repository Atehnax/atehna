import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import type {
  StorefrontSpecification
} from '@/commercial/features/products/storefrontProduct';
import {
  getStorefrontSpecificationOrderKey,
  prepareStorefrontSpecifications,
  STOREFRONT_DIMENSIONS_SPECIFICATION_KEY
} from '@/commercial/features/products/storefrontSpecifications';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

const specification = (
  id: string,
  label: string,
  value: string
): StorefrontSpecification => ({ id, label, value });

describe('storefront specification ordering', () => {
  test('collapses dimensional rows, applies the configured order, and appends unknown rows stably', () => {
    const rows = [
      specification('finish', 'Povr\u0161ina', 'Bru\u0161ena'),
      specification('length', 'Dol\u017eina', '100 mm'),
      specification('material', 'Material', 'Aluminij'),
      specification('width', '\u0160irina', '100 mm'),
      specification('tolerance', 'Toleranca', '\u00b11 mm'),
      specification('thickness', 'Debelina', '0.3 mm'),
      specification('usage', 'Uporaba', 'Modelarstvo')
    ];

    const prepared = prepareStorefrontSpecifications(rows, [
      'material',
      STOREFRONT_DIMENSIONS_SPECIFICATION_KEY,
      'toleranca'
    ]);

    expect(prepared.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Material', value: 'Aluminij' },
      { label: 'Dimenzije', value: '0,3 \u00d7 100 \u00d7 100 mm' },
      { label: 'Toleranca', value: '\u00b11 mm' },
      { label: 'Povr\u0161ina', value: 'Bru\u0161ena' },
      { label: 'Uporaba', value: 'Modelarstvo' }
    ]);
    expect(prepared.map((row) => row.id)).not.toEqual(
      expect.arrayContaining(['length', 'width', 'thickness'])
    );
  });

  test('uses one stable order key for every dimensional alias and keeps an explicit combined row', () => {
    for (const label of [
      'Dimenzije',
      'dimensions',
      'Debelina',
      'thickness',
      'Dol\u017eina',
      'length',
      '\u0160irina',
      'width'
    ]) {
      expect(
        getStorefrontSpecificationOrderKey({ label }),
        `${label} should share the combined dimensions order key`
      ).toBe(STOREFRONT_DIMENSIONS_SPECIFICATION_KEY);
    }

    const prepared = prepareStorefrontSpecifications([
      specification('length', 'Dol\u017eina', '200 mm'),
      specification('combined', 'Dimenzije', 'Posebna mera'),
      specification('width', '\u0160irina', '150 mm')
    ], [STOREFRONT_DIMENSIONS_SPECIFICATION_KEY]);

    expect(prepared).toEqual([
      specification('combined', 'Dimenzije', 'Posebna mera')
    ]);
  });

  test('normalizes and persists a custom specification order without losing unknown keys', () => {
    expect(
      DEFAULT_PRODUCT_APPEARANCE_CONFIG.secondaryContent.specificationOrder
    ).toEqual([
      'material',
      'barva',
      'oblika',
      STOREFRONT_DIMENSIONS_SPECIFICATION_KEY,
      'teza',
      'toleranca',
      'sku'
    ]);

    const normalized = normalizeProductAppearanceConfig({
      secondaryContent: {
        specificationOrder: [
          ' material ',
          STOREFRONT_DIMENSIONS_SPECIFICATION_KEY,
          'lastnost-po-meri',
          'material',
          '',
          42
        ]
      }
    });

    expect(normalized.secondaryContent.specificationOrder).toEqual([
      'material',
      STOREFRONT_DIMENSIONS_SPECIFICATION_KEY,
      'lastnost-po-meri'
    ]);
    expect(
      normalizeProductAppearanceConfig(normalized)
        .secondaryContent.specificationOrder
    ).toEqual(normalized.secondaryContent.specificationOrder);
  });

  test('the specifications content panel exposes accessible reordering and saves visible order keys', () => {
    const toolbarSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
      ),
      'utf8'
    );
    const specificationTableSource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/SpecificationTable.tsx'
      ),
      'utf8'
    );

    expect(toolbarSource).toContain('getStorefrontSpecificationOrderKey');
    expect(toolbarSource).toContain('prepareStorefrontSpecifications');
    expect(toolbarSource).toContain(
      'aria-label={`Premakni ${specification.label} gor`}'
    );
    expect(toolbarSource).toContain(
      'aria-label={`Premakni ${specification.label} dol`}'
    );
    expect(toolbarSource).toContain('function moveDisplayedSpecification');
    expect(toolbarSource).toContain('const visibleKeys = displayedSpecifications.map(');
    expect(toolbarSource).toContain('specificationOrder: [');
    expect(toolbarSource).toContain('...visibleKeys');
    expect(specificationTableSource).toContain('prepareStorefrontSpecifications');
    expect(specificationTableSource).toContain(
      'appearance.secondaryContent.specificationOrder'
    );
  });
});
