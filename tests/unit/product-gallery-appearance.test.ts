import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  toProductAppearanceCssVariables,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';
import {
  resolveGalleryZoomOrigin
} from '@/commercial/components/storefront/productGalleryZoom';

describe('product gallery appearance contracts', () => {
  test('normalizes and stores every thumbnail layout control', () => {
    expect(DEFAULT_PRODUCT_APPEARANCE_CONFIG.gallery).toMatchObject({
      sizePercent: 100,
      thumbnailPositionDesktop: 'left',
      thumbnailPositionMobile: 'bottom',
      thumbnailSizePx: 70,
      thumbnailGapPx: 16,
      hideThumbnailsWhenSingle: true
    });

    const normalized = normalizeProductAppearanceConfig({
      gallery: {
        sizePercent: 120,
        thumbnailPositionDesktop: 'right',
        thumbnailPositionMobile: 'top',
        thumbnailSizePx: 140,
        thumbnailGapPx: -5,
        hideThumbnailsWhenSingle: false
      }
    });

    expect(normalized.gallery).toMatchObject({
      sizePercent: 100,
      thumbnailPositionDesktop: 'right',
      thumbnailPositionMobile: 'top',
      thumbnailSizePx: 120,
      thumbnailGapPx: 0,
      hideThumbnailsWhenSingle: false
    });
    expect(toStoredProductAppearanceConfig(normalized).gallery).toEqual(
      normalized.gallery
    );
    expect(toProductAppearanceCssVariables(normalized)).toMatchObject({
      '--product-gallery-size': '100%',
      '--product-gallery-thumbnail-size': '120px',
      '--product-gallery-thumbnail-gap': '0px'
    });
  });

  test('preserves authored thumbnail dimensions', () => {
    const normalized = normalizeProductAppearanceConfig({
      gallery: {
        thumbnailSizePx: 64,
        thumbnailGapPx: 12
      }
    });

    expect(normalized.gallery).toMatchObject({
      sizePercent: 100,
      thumbnailSizePx: 64,
      thumbnailGapPx: 12
    });
    expect(toProductAppearanceCssVariables(normalized)).toMatchObject({
      '--product-gallery-size': '100%',
      '--product-gallery-thumbnail-size': '64px',
      '--product-gallery-thumbnail-gap': '12px'
    });
  });

  test('shared gallery renderer exposes responsive placement and modern controls', () => {
    const gallerySource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductGallery.tsx'
      ),
      'utf8'
    );
    const detailSource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductDetailView.tsx'
      ),
      'utf8'
    );
    const contextToolbarSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
      ),
      'utf8'
    );
    const globalStyles = readFileSync(
      resolve(process.cwd(), 'src/shared/styles/globals.css'),
      'utf8'
    );

    expect(gallerySource).toContain('data-thumbnail-position-desktop');
    expect(gallerySource).toContain('data-thumbnail-position-mobile');
    expect(gallerySource).toContain('data-thumbnail-position-preview');
    expect(gallerySource).toContain('hideThumbnailsWhenSingle');
    expect(gallerySource).toContain('className="object-cover"');
    expect(gallerySource).not.toContain('object-contain p-1.5');
    expect(gallerySource).toContain('storefront-gallery-control');
    expect(gallerySource).toContain('storefront-gallery-control-visual');
    expect(gallerySource).toContain('data-gallery-control="next"');
    expect(gallerySource).toContain('data-gallery-control="zoom-indicator"');
    expect(gallerySource).toContain('data-gallery-control="lightbox-close"');
    expect(gallerySource).toContain('lightboxCloseControlClassName');
    expect(gallerySource).not.toContain('backdrop-blur-sm');
    expect(globalStyles).toContain('background: rgb(15 23 42 / 0.68);');
    expect(gallerySource).toContain('openZoom');
    expect(gallerySource).toContain('closeZoom');
    expect(gallerySource).toContain('data-storefront-gallery-lightbox');
    expect(gallerySource).toContain('cubic-bezier(0.22,1,0.36,1)');

    expect(detailSource).toContain('previewDevice={canvasEditor?.device}');
    expect(contextToolbarSource).toContain(
      'testId="product-gallery-thumbnail-position"'
    );
    expect(contextToolbarSource).toContain(
      'data-testid="product-gallery-size"'
    );
    expect(contextToolbarSource).toContain(
      'data-testid="product-gallery-thumbnail-size"'
    );
    expect(contextToolbarSource).toContain(
      'data-testid="product-gallery-thumbnail-gap"'
    );
    expect(contextToolbarSource).toContain(
      'data-testid="product-gallery-hide-single-thumbnail"'
    );

    expect(globalStyles).toContain(
      'gap: var(--product-gallery-thumbnail-gap, 16px)'
    );
    expect(globalStyles).toContain(
      'inline-size: var(--product-gallery-size, 100%)'
    );
    expect(globalStyles).toContain(
      "grid-template-areas: 'gallery-thumbnails gallery-main'"
    );
    expect(globalStyles).toContain(
      "grid-template-areas: 'gallery-main gallery-thumbnails'"
    );
  });

  test('hover zoom follows the pointer inside the existing gallery surface', () => {
    expect(resolveGalleryZoomOrigin({
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      clientX: 300,
      clientY: 150
    })).toEqual({
      xPercent: 50,
      yPercent: 50
    });

    expect(resolveGalleryZoomOrigin({
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      clientX: 200,
      clientY: 200
    })).toEqual({
      xPercent: 25,
      yPercent: 75
    });

    expect(resolveGalleryZoomOrigin({
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      clientX: -100,
      clientY: 400
    })).toEqual({
      xPercent: 0,
      yPercent: 100
    });

    expect(resolveGalleryZoomOrigin({
      left: 100,
      top: 50,
      width: 300,
      height: 300,
      clientX: 233.333,
      clientY: 166.667
    })).toEqual({
      xPercent: 44.44,
      yPercent: 38.89
    });

    expect(resolveGalleryZoomOrigin({
      left: 100,
      top: 50,
      width: 0,
      height: -1,
      clientX: 999,
      clientY: 999
    })).toEqual({
      xPercent: 50,
      yPercent: 50
    });

    const gallerySource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductGallery.tsx'
      ),
      'utf8'
    );

    expect(gallerySource).toContain('onPointerMove');
    expect(gallerySource).toContain('onPointerLeave');
    expect(gallerySource).toContain('resolveGalleryZoomOrigin');
    expect(gallerySource).toContain('transformOrigin');
    expect(gallerySource).toContain('duration-[360ms]');
    expect(gallerySource).toContain('cubic-bezier(0.4,0,0.2,1)');
    expect(gallerySource).not.toContain('group-hover:scale-110');

    const resetHoverZoomStart = gallerySource.indexOf(
      'const resetHoverZoom = useCallback'
    );
    const updateHoverZoomStart = gallerySource.indexOf(
      'const updateHoverZoom = useCallback'
    );
    const resetHoverZoomSource = gallerySource.slice(
      resetHoverZoomStart,
      updateHoverZoomStart
    );
    expect(resetHoverZoomSource).not.toContain(
      "'--storefront-gallery-zoom-x'"
    );
    expect(resetHoverZoomSource).not.toContain(
      "'--storefront-gallery-zoom-y'"
    );
  });

  test('the shared lightbox is compact and closes from its backdrop or image surface', () => {
    const gallerySource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductGallery.tsx'
      ),
      'utf8'
    );
    const detailSource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductDetailView.tsx'
      ),
      'utf8'
    );
    const livePreviewSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceLivePreview.tsx'
      ),
      'utf8'
    );

    expect(gallerySource).toContain('data-storefront-gallery-lightbox');
    expect(gallerySource).toContain(
      'data-storefront-gallery-lightbox-content'
    );
    const lightboxMarker = gallerySource.indexOf(
      'data-storefront-gallery-lightbox'
    );
    const lightboxShellStart = gallerySource.lastIndexOf(
      '<div',
      lightboxMarker
    );
    const closeButtonStart = gallerySource.indexOf(
      '<button',
      lightboxMarker
    );
    const lightboxShellSource = gallerySource.slice(
      lightboxShellStart,
      closeButtonStart
    );
    const closeButtonSource = gallerySource.slice(
      closeButtonStart,
      gallerySource.indexOf('</button>', closeButtonStart)
    );
    expect(lightboxShellSource).toContain('onClick=');
    expect(lightboxShellSource).toContain('closeZoom');
    expect(closeButtonSource).toContain('onClick=');
    expect(closeButtonSource).toContain('closeZoom');
    expect(gallerySource).not.toContain(
      'if (event.target === event.currentTarget) closeZoom();'
    );
    expect(gallerySource).toContain('max-h-[72dvh]');
    expect(gallerySource).toContain('max-w-[72vw]');
    expect(gallerySource).toContain(
      'width: `min(72vw, calc(72dvh * ${selectedImageAspectRatio}))`'
    );
    expect(gallerySource).toContain(
      'items-center justify-center bg-slate-950/65 p-2'
    );
    expect(gallerySource).not.toContain('h-[min(84vh,900px)]');
    expect(gallerySource).not.toContain('w-[min(92vw,1200px)]');

    // The admin preview deliberately renders the commercial product detail
    // implementation, so neither surface can drift to a separate gallery.
    expect(detailSource).toContain(
      "import ProductGallery from '@/commercial/components/storefront/ProductGallery';"
    );
    expect(detailSource).toContain('<ProductGallery');
    expect(livePreviewSource).toContain(
      "import ProductDetailView from '@/commercial/components/storefront/ProductDetailView';"
    );
    expect(livePreviewSource).toContain('<ProductDetailView');
    expect(livePreviewSource).not.toContain('<ProductGallery');
  });
});
