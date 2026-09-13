import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  getVisibleProductMedia,
  resolveProductGallerySelection
} from '@/commercial/components/storefront/productGalleryMedia';
import type { StorefrontProductMedia } from '@/commercial/features/products/storefrontProduct';

const image = (
  id: string,
  variantIds: string[] = [],
  imageType = 'product-photo',
  url = '/' + id + '.png'
): StorefrontProductMedia => ({
  id,
  kind: 'image',
  role: 'gallery',
  url,
  altText: id,
  variantIds,
  imageType
});

const ids = (media: StorefrontProductMedia[]) => media.map((entry) => entry.id);

describe('variant gallery media', () => {
  test('prioritizes matching photos and only shows the matching individual sketch', () => {
    const shared = image('shared');
    const variantPhoto = image('variant-a', ['a']);
    const sketch = image('sketch-a', ['a'], 'dimension-diagram');
    const media = [
      shared,
      image('legacy', [], 'dimension-overview'),
      image('unassigned-sketch', [], 'dimension-diagram'),
      image('sketch-b', ['b'], 'dimension-diagram'),
      sketch,
      image('shared-copy', [], 'product-photo', variantPhoto.url),
      variantPhoto,
      image('variant-b', ['b'])
    ];
    const before = structuredClone(media);
    for (const entry of media) {
      Object.freeze(entry.variantIds);
      Object.freeze(entry);
    }
    Object.freeze(media);

    const visible = getVisibleProductMedia(media, 'a');
    assert.deepEqual(ids(visible), ['variant-a', 'shared', 'sketch-a']);
    assert.equal(visible[0], variantPhoto);
    assert.equal(visible[1], shared);
    assert.equal(visible[2], sketch);
    assert.deepEqual(media, before);
  });

  test('unassigned individual sketches are never general product media', () => {
    const media = [
      image('shared'),
      image('sketch-a', ['a'], 'dimension-diagram'),
      image('unassigned-sketch', [], 'dimension-diagram'),
      image('variant-a', ['a']),
      image('legacy', [], 'dimension-overview')
    ];
    assert.deepEqual(ids(getVisibleProductMedia(media, null)), ['shared', 'legacy']);
    assert.deepEqual(ids(getVisibleProductMedia(media, 'b')), ['shared', 'legacy']);
  });

  test('keeps a legacy overview only until that variant has an individual sketch', () => {
    const media = [
      image('shared'),
      image('legacy', [], 'dimension-overview'),
      image('sketch-a', ['a'], 'dimension-diagram')
    ];
    assert.deepEqual(ids(getVisibleProductMedia(media, 'a')), ['shared', 'sketch-a']);
    assert.deepEqual(ids(getVisibleProductMedia(media, 'b')), ['shared', 'legacy']);
  });

  test('switches directly between variant sketches while preserving the selected media kind', () => {
    const photo = image('shared');
    const sketchA = image('sketch-a', ['a'], 'dimension-diagram');
    const sketchB = image('sketch-b', ['b'], 'dimension-diagram');
    const overview = image('legacy', [], 'dimension-overview');
    const media = [photo, overview, sketchA, sketchB];
    const visibleB = getVisibleProductMedia(media, 'b');
    const selectedB = resolveProductGallerySelection(visibleB, sketchA);
    assert.equal(selectedB, sketchB);
    assert.equal(selectedB?.url, '/sketch-b.png');
    assert.equal(resolveProductGallerySelection(visibleB, overview), sketchB);
    assert.equal(
      resolveProductGallerySelection(getVisibleProductMedia(media, 'a'), selectedB),
      sketchA
    );
  });

  test('retains shared photos and falls back safely when the selected media disappears', () => {
    const shared = image('shared');
    const photoA = image('photo-a', ['a']);
    const photoB = image('photo-b', ['b']);
    const sketchA = image('sketch-a', ['a'], 'dimension-diagram');
    const visibleB = getVisibleProductMedia([shared, photoA, photoB, sketchA], 'b');
    assert.equal(resolveProductGallerySelection(visibleB, shared), shared);
    assert.equal(resolveProductGallerySelection(visibleB, photoA), photoB);
    assert.equal(resolveProductGallerySelection(visibleB, sketchA), photoB);
    assert.equal(resolveProductGallerySelection(visibleB, null), photoB);
    assert.equal(resolveProductGallerySelection([], sketchA), null);
  });
});
