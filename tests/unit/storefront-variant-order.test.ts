import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import { buildStorefrontProductFromCatalogItem } from '@/commercial/features/products/storefrontProduct';
import { buildDimensionalVariantSelectorModel } from '@/commercial/features/products/dimensionalVariants';
const productContext = {
  href: '/products/materiali/items/aluminijasta-plosca',
  fallbackSku: 'MAT-KOV-ALU',
  fallbackPrice: 0,
  category: {
    slug: 'materiali',
    title: 'Materiali',
    href: '/products/materiali'
  },
  subcategory: {
    slug: 'kovine',
    title: 'Kovine',
    href: '/products/materiali/kovine'
  }
};

test('storefront variants and the legacy selector follow the persisted variant position', () => {
  const catalogItem = {
    slug: 'testni-artikel',
    name: 'Testni artikel',
    description: '',
    status: 'active',
    defaultVariantId: 22,
    variants: [
      {
        id: 33,
        variantName: 'Tretja',
        variantSku: 'T-3',
        position: 3,
        price: 3,
        inventory: 1,
        status: 'active'
      },
      {
        id: 11,
        variantName: 'Prva',
        variantSku: 'T-1',
        position: 1,
        price: 1,
        inventory: 1,
        status: 'active'
      },
      {
        id: 22,
        variantName: 'Druga',
        variantSku: 'T-2',
        position: 2,
        price: 2,
        inventory: 1,
        status: 'active'
      }
    ]
  } as unknown as CatalogItem;

  const product = buildStorefrontProductFromCatalogItem(catalogItem, {
    href: '/products/testni-artikel',
    fallbackSku: 'TEST',
    fallbackPrice: 0,
    category: {
      slug: 'test',
      title: 'Test',
      href: '/products/test'
    }
  });

  expect(product.variants.map((variant) => variant.name)).toEqual([
    'Prva',
    'Druga',
    'Tretja'
  ]);
  expect(product.variants.map((variant) => variant.position)).toEqual([1, 2, 3]);
  expect(product.optionAxes[0]?.values.map((value) => value.label)).toEqual([
    'Prva',
    'Druga',
    'Tretja'
  ]);
  expect(product.defaultVariantId).toBe('22');
});

test('product detail keeps the parent heading, cleans rich text, and labels dimensional variants', () => {
  const catalogItem = {
    id: 91,
    slug: 'aluminijasta-plosca',
    name: 'Aluminijasta plošča',
    description:
      '<p style="font-size: 18px" onclick="alert(1)">Aluminijasta plošča &amp; komplet za modelarstvo.</p><script>alert(2)</script><ul><li>Primerna za tehnični pouk</li></ul>',
    productType: 'dimensions',
    status: 'active',
    defaultVariantId: 911,
    variants: [
      {
        id: 911,
        variantName: '0,3 × 100 × 100 mm',
        variantSku: 'MAT-KOV-ALU-03-100',
        position: 1,
        thickness: 0.3,
        length: 100,
        width: 100,
        price: 12,
        inventory: 4,
        minOrder: 1,
        status: 'active'
      },
      {
        id: 912,
        variantName: '0,5 × 200 × 200 mm',
        variantSku: 'MAT-KOV-ALU-05-200',
        position: 2,
        thickness: 0.5,
        length: 200,
        width: 200,
        price: 24,
        inventory: 2,
        minOrder: 1,
        status: 'active'
      }
    ]
  } as unknown as CatalogItem;

  const product = buildStorefrontProductFromCatalogItem(
    catalogItem,
    productContext
  );
  const detailSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductDetailView.tsx'
    ),
    'utf8'
  );

  expect(detailSource).toMatch(/const displayTitle\s*=\s*product\.name;/);
  expect(detailSource).toMatch(
    /<h1[^>]*>\s*\{displayTitle\}\s*<\/h1>/
  );
  expect(product.name).toBe('Aluminijasta plošča');
  expect(product.shortDescription).toContain(
    'Aluminijasta plošča & komplet za modelarstvo.'
  );
  expect(product.shortDescription).toContain('Primerna za tehnični pouk');
  expect(product.description).not.toContain('<p>');
  expect(product.description).not.toContain('<li>');
  expect(product.descriptionHtml).toContain('<p style="font-size:18px">');
  expect(product.descriptionHtml).toContain('<ul><li>');
  expect(product.descriptionHtml).not.toContain('onclick');
  expect(product.descriptionHtml).not.toContain('<script');
  expect(detailSource).toContain('dangerouslySetInnerHTML');
  expect(product.optionAxes[0]?.name).toBe('Dimenzije');
  expect(product.variants[0]?.dimensions).toEqual({
    length: 100,
    width: 100,
    thickness: 0.3
  });
  expect(
    buildDimensionalVariantSelectorModel(
      product.optionAxes,
      product.variants
    )?.groups.map((group) => ({
      thickness: group.thicknessLabel,
      sizes: group.choices.map((choice) => choice.sizeLabel)
    }))
  ).toEqual([
    { thickness: '0,3 mm', sizes: ['100 × 100 mm'] },
    { thickness: '0,5 mm', sizes: ['200 × 200 mm'] }
  ]);
});

test('generic variant options honor the same compact height and type settings', () => {
  const selectorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/VariantSelector.tsx'
    ),
    'utf8'
  );
  const stylesSource = readFileSync(
    resolve(process.cwd(), 'src/shared/styles/globals.css'),
    'utf8'
  );

  expect(selectorSource).toContain('storefront-variant-option');
  expect(stylesSource).toMatch(
    /\.storefront-variant-option\s*\{[\s\S]*--product-variant-chip-height[\s\S]*--product-variant-chip-font-size/
  );
});

test('technical documents only exist in storefront data after a valid upload is present', () => {
  const baseItem = {
    id: 91,
    slug: 'aluminijasta-plosca',
    name: 'Aluminijasta plošča',
    description: 'Opis',
    status: 'active',
    variants: [
      {
        id: 911,
        variantName: '0,3 × 100 × 100 mm',
        variantSku: 'MAT-KOV-ALU-03-100',
        position: 1,
        price: 12,
        inventory: 4,
        minOrder: 1,
        status: 'active'
      }
    ]
  };

  const withoutDocuments = buildStorefrontProductFromCatalogItem(
    baseItem as unknown as CatalogItem,
    productContext
  );
  const withDocument = buildStorefrontProductFromCatalogItem(
    {
      ...baseItem,
      media: [
        {
          id: 70,
          mediaKind: 'document',
          role: 'technical_sheet',
          blobUrl: '/documents/aluminijasta-plosca.pdf',
          filename: 'Tehnični list',
          mimeType: 'application/pdf',
          hidden: false
        }
      ]
    } as unknown as CatalogItem,
    productContext
  );

  expect(withoutDocuments.documents).toEqual([]);
  expect(withoutDocuments.variants[0]?.documents).toEqual([]);
  expect(withDocument.documents).toEqual([
    expect.objectContaining({
      name: 'Tehnični list',
      url: '/documents/aluminijasta-plosca.pdf'
    })
  ]);
});

test('product details use the shared storefront tab treatment and conditional document section', () => {
  const detailSource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductDetailView.tsx'
    ),
    'utf8'
  );
  const gallerySource = readFileSync(
    resolve(
      process.cwd(),
      'src/commercial/components/storefront/ProductGallery.tsx'
    ),
    'utf8'
  );

  expect(detailSource).toMatch(/className="storefront-detail-tabs"/);
  expect(detailSource).toMatch(/className="storefront-detail-tab"/);
  expect(detailSource).toMatch(
    /block === 'documents' && documents\.length > 0/
  );
  expect(gallerySource).toContain("'storefront-product-gallery-image'");
  expect(gallerySource).not.toContain(
    "'storefront-product-gallery-image p-3'"
  );
});
