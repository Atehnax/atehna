import assert from 'node:assert/strict';
import test from 'node:test';
import { blankLogoProject, defaultLogoAssignments, LOGO_PLACEMENT_IDS, type LogoLibrary, type LogoVariant } from '@/shared/domain/logo/logoLibrary';
import { publishedLogoProjection } from '@/shared/domain/logo/publishedLogo';
import { publishedLogoProjection as serverProjection } from '@/shared/server/logoLibraryOperations';

function variant(id = 'published'): LogoVariant {
  const image = { url: `/logos/${id}.png`, pathname: `private-output-${id}`, width: 320, height: 100, mimeType: 'image/png' as const };
  return { id, name: 'Objavljeni logotip', draft: { ...blankLogoProject(), canvas: { width: 500, height: 200 } }, draftRevision: 3, updatedAt: '2026-09-06T00:00:00Z', history: [], published: {
    id: `revision-${id}`, createdAt: '2026-09-05T00:00:00Z', project: blankLogoProject(), png: image,
    png2x: { ...image, width: 640, height: 200 }, svg: { ...image, url: `/logos/${id}.svg`, mimeType: 'image/svg+xml' },
    bounds: { x: 20, y: 15, width: 280, height: 70 }
  } };
}
function fixture(): LogoLibrary {
  return { version: 1, revision: 9, assets: [], variants: [variant()], placements: defaultLogoAssignments(), migratedAt: '2026-09-05T00:00:00Z' };
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

test('shared projection returns published outputs ahead of fallback without exposing editable data', () => {
  const library = fixture();
  library.placements['header-desktop'] = { variantId: 'published', fallback: 'none' };
  const result = publishedLogoProjection(library);
  assert.equal(serverProjection, publishedLogoProjection);
  assert.equal(result.revision, 9);
  assert.deepEqual(Object.keys(result.placements), [...LOGO_PLACEMENT_IDS]);
  assert.deepEqual(result.placements['header-desktop'], {
    variantId: 'published', name: 'Objavljeni logotip', revision: 'revision-published', pngUrl: '/logos/published.png', svgUrl: '/logos/published.svg', width: 320, height: 100,
    bounds: { x: 20, y: 15, width: 280, height: 70 }
  });
  assert.doesNotMatch(JSON.stringify(result), /private-output|draft|layers|history|pathname|assets/u);
});

test('default assignments follow the standalone publication while explicit device choices stay independent', () => {
  const library = fixture();
  library.variants.push(variant('mobile'));
  library.placements.standalone = { variantId: 'published', fallback: 'original' };
  library.placements['header-desktop'] = { variantId: null, fallback: 'default' };
  library.placements['header-tablet'] = { variantId: null, fallback: 'default' };
  library.placements['header-mobile'] = { variantId: 'mobile', fallback: 'default' };
  const result = publishedLogoProjection(library);
  assert.deepEqual(result.placements['header-desktop'], result.placements.standalone);
  assert.deepEqual(result.placements['header-tablet'], result.placements.standalone);
  assert.equal(result.placements['header-mobile']?.variantId, 'mobile');
  assert.notEqual(result.placements['header-desktop'], result.placements.standalone);
  assert.notEqual(result.placements['header-desktop']?.bounds, result.placements['header-tablet']?.bounds);
});

test('original, brand and none fallbacks preserve their established dimensions and URLs', () => {
  const library = fixture();
  library.placements['header-desktop'] = { variantId: null, fallback: 'original' };
  library.placements['header-tablet'] = { variantId: null, fallback: 'brand' };
  library.placements['header-mobile'] = { variantId: null, fallback: 'none' };
  const result = publishedLogoProjection(library);
  assert.deepEqual(result.placements['header-desktop'], { variantId: null, name: 'Atehna · izvirnik', revision: 'original-v1', pngUrl: '/brand/atehna-document-wordmark.png', svgUrl: null, width: 1873, height: 840, bounds: { x: 0, y: 0, width: 1873, height: 840 }, fallback: 'original' });
  assert.deepEqual(result.placements['header-tablet'], { variantId: null, name: 'Atehna', revision: 'brand-v1', pngUrl: '', svgUrl: null, width: 130, height: 30, bounds: { x: 0, y: 0, width: 130, height: 30 }, fallback: 'brand' });
  assert.equal(result.placements['header-mobile'], null);
});

test('missing or unpublished variants use configured fallback and standalone default terminates safely', () => {
  const library = fixture();
  library.variants[0].published = null;
  library.placements.standalone = { variantId: 'published', fallback: 'default' };
  library.placements['header-desktop'] = { variantId: 'missing', fallback: 'default' };
  library.placements['header-tablet'] = { variantId: 'published', fallback: 'brand' };
  library.placements['header-mobile'] = { variantId: 'published', fallback: 'none' };
  let result = publishedLogoProjection(library);
  assert.equal(result.placements.standalone?.fallback, 'original');
  assert.deepEqual(result.placements['header-desktop'], result.placements.standalone);
  assert.equal(result.placements['header-tablet']?.fallback, 'brand');
  assert.equal(result.placements['header-mobile'], null);
  library.placements.standalone = { variantId: null, fallback: 'none' };
  result = publishedLogoProjection(library);
  assert.equal(result.placements['header-desktop'], null);
  library.placements.standalone = { variantId: null, fallback: 'brand' };
  assert.equal(publishedLogoProjection(library).placements['header-desktop']?.fallback, 'brand');
});

test('projection and provisional assignment changes never mutate saved library or alias returned bounds', () => {
  const saved = fixture();
  saved.placements.standalone = { variantId: 'published', fallback: 'none' };
  saved.placements['header-desktop'] = { variantId: null, fallback: 'default' };
  const before = structuredClone(saved);
  freeze(saved);
  const current = publishedLogoProjection(saved);
  const provisional = structuredClone(saved);
  provisional.placements['header-desktop'] = { variantId: null, fallback: 'brand' };
  const preview = publishedLogoProjection(provisional);
  assert.equal(preview.placements['header-desktop']?.fallback, 'brand');
  assert.equal(current.placements['header-desktop']?.variantId, 'published');
  current.placements['header-desktop']!.bounds.width = 99;
  assert.equal(current.placements.standalone?.bounds.width, 280);
  assert.equal(preview.placements.standalone?.bounds.width, 280);
  assert.deepEqual(saved, before);
});
