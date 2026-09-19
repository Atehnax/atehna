import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCatalogImageOriginal } from '@/shared/domain/catalog/catalogImageOriginal';
import { normalizeImagePixelDimensions } from '@/admin/features/artikli/lib/imageMediaMetadata';
import { resolveProductGallerySelection } from '@/commercial/components/storefront/productGalleryMedia';
import { buildStorefrontProductFromCatalogItem } from '@/commercial/features/products/storefrontProduct';

const original = {
  originalUrl: '/images/catalog/reviewed/native.png', originalWidth: 2400, originalHeight: 1600
};

test('original source accepts public raster paths and the configured blob hostname pattern', () => {
  assert.deepEqual(normalizeCatalogImageOriginal(original), original);
  const blob = { originalUrl: 'https://example.public.blob.vercel-storage.com/catalog/original.jpg' };
  assert.deepEqual(normalizeCatalogImageOriginal(blob), blob);
  assert.deepEqual(normalizeCatalogImageOriginal({ ...original, originalWidth: NaN }), {
    originalUrl: original.originalUrl
  });
});

test('original source cannot introduce arbitrary origins, unsafe navigation or executable image links', () => {
  for (const originalUrl of [
    'javascript:alert(1)', 'data:image/png;base64,test', '//evil.example/image.png',
    'https://evil.example/image.png', 'https://example.public.blob.vercel-storage.com.evil.example/image.png',
    'https://user:password@example.public.blob.vercel-storage.com/image.png',
    '/api/admin/file.png', '/images/../private/image.png', '/images/%2e%2e/private/image.png',
    '/images/escape\\image.png', '/images/catalog/image.svg', '/images/catalog/image.png?redirect=elsewhere'
  ]) assert.deepEqual(normalizeCatalogImageOriginal({ originalUrl }), {}, originalUrl);
});

test('retained editor metadata survives JSON hydration and repeated normalization', () => {
  const saved = { width: 2280, height: 406, ...original };
  const hydrated = normalizeImagePixelDimensions(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(hydrated, saved);
  const measured = { ...hydrated, width: 2280, height: 406 };
  assert.deepEqual(normalizeImagePixelDimensions(measured), saved);
  assert.deepEqual(normalizeImagePixelDimensions({ ...saved, originalUrl: 'https://evil.example/image.png' }), {
    width: 2280, height: 406
  });
});

test('catalog normalization preserves display crop, native zoom source and fresh replacement identity', () => {
  const build = (dimensions: unknown) => {
    const catalogItem = {
    id: 1, slug: 'ruler', name: 'Ravnilo', description: 'Merilno ravnilo.', status: 'active',
    media: [{ id: 4, mediaKind: 'image', role: 'gallery', blobUrl: '/images/catalog/crop.png',
      altText: 'Ravnilo', imageDimensions: dimensions }],
    variants: [{ id: 1, variantName: 'Ravnilo', status: 'active', price: 1, inventory: 10 }]
    };
    return buildStorefrontProductFromCatalogItem(catalogItem, {
    href: '/products/tools/items/ruler', fallbackSku: 'RULER', fallbackPrice: 1,
    category: { slug: 'tools', title: 'Tools', href: '/products/tools' }
    });
  };
  const media = build({ width: 2280, height: 406, ...original }).media;
  assert.equal(media[0].url, '/images/catalog/crop.png');
  assert.equal(media[0].originalUrl, original.originalUrl);
  assert.equal(media[0].originalWidth, 2400);
  assert.equal(media[0].originalHeight, 1600);
  const replacement = { ...media[0], originalUrl: '/images/catalog/replacement.png' };
  assert.equal(resolveProductGallerySelection([replacement], media[0]), replacement);
  assert.equal(resolveProductGallerySelection([], replacement), null);
  assert.equal(build({ originalUrl: '//evil.example/image.png' }).media[0].originalUrl, undefined);
});
