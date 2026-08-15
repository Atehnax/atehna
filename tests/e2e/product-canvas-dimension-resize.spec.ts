import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  normalizeProductAppearanceConfig,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';
import {
  resolveProductCanvasResize
} from '@/shared/ui/product-canvas/ProductCanvasElement';

const source = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8'
);

test.describe('product canvas dimension resizing', () => {
  test('every selectable canvas section is wired through the shared width and height controls', () => {
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const canvasElementSource = source(
      'src/shared/ui/product-canvas/ProductCanvasElement.tsx'
    );

    const inventoryStart = editorSource.indexOf('const productCanvasElements');
    const inventoryEnd = editorSource.indexOf('const sections', inventoryStart);
    const inventorySource = editorSource.slice(inventoryStart, inventoryEnd);
    const selectableElementIds = [
      ...inventorySource.matchAll(/\{ id: '([^']+)'/g)
    ].map((match) => match[1]);

    expect(selectableElementIds.length).toBeGreaterThanOrEqual(38);
    expect(new Set(selectableElementIds).size).toBe(selectableElementIds.length);
    expect(selectableElementIds).toEqual(expect.arrayContaining([
      'listing-header',
      'listing-card',
      'product-gallery',
      'product-information',
      'product-purchase',
      'product-secondary',
      'product-related-products',
      'cart-panel',
      'cart-summary'
    ]));

    // Every page-specific inventory entry is mapped to the same responsive
    // device settings object and passed to the contextual toolbar. Dimension
    // controls therefore cannot silently exist for only a hand-picked section.
    expect(editorSource).toContain(
      'const visibleCanvasElements = productCanvasElements.filter'
    );
    expect(editorSource).toContain(
      'const contextToolbarElements = visibleCanvasElements.map'
    );
    expect(editorSource).toContain(
      'settings: resolveProductCanvasElementDeviceSettings(config, element.id, previewDevice)'
    );
    expect(editorSource).toContain('elements={contextToolbarElements}');
    expect(editorSource).toContain('settings={selectedCanvasSettings}');

    expect(toolbarSource).toContain('settings.widthPx');
    expect(toolbarSource).toContain('settings.heightPx');
    expect(toolbarSource).toContain('settings.aspectRatioLocked');
    expect(toolbarSource).toContain('resolveProductCanvasResize');
    expect(canvasElementSource).toContain('data-product-canvas-resize');
    expect(canvasElementSource).toContain('resolveProductCanvasResize');
  });

  test('unlocked dimensions can be edited independently', () => {
    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 360,
      nextHeight: 999,
      axis: 'width',
      aspectRatioLocked: false
    })).toEqual({
      widthPx: 360
    });

    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 999,
      nextHeight: 150,
      axis: 'height',
      aspectRatioLocked: false
    })).toEqual({
      heightPx: 150
    });

    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 440,
      nextHeight: 260,
      axis: 'both',
      aspectRatioLocked: false
    })).toEqual({
      widthPx: 440,
      heightPx: 260
    });
  });

  test('locked single-axis edits and corner drags preserve the measured ratio', () => {
    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 300,
      nextHeight: 200,
      axis: 'width',
      aspectRatioLocked: true
    })).toEqual({
      widthPx: 300,
      heightPx: 150
    });

    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 400,
      nextHeight: 125,
      axis: 'height',
      aspectRatioLocked: true
    })).toEqual({
      widthPx: 250,
      heightPx: 125
    });

    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 500,
      nextHeight: 210,
      axis: 'both',
      aspectRatioLocked: true
    })).toEqual({
      widthPx: 500,
      heightPx: 250
    });

    expect(resolveProductCanvasResize({
      startWidth: 400,
      startHeight: 200,
      nextWidth: 420,
      nextHeight: 300,
      axis: 'both',
      aspectRatioLocked: true
    })).toEqual({
      widthPx: 600,
      heightPx: 300
    });
  });

  test('aspect-ratio locking is normalized responsively and survives storage round-trips', () => {
    expect(
      DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS.aspectRatioLocked
    ).toBe(false);

    const normalized = normalizeProductAppearanceConfig({
      canvas: {
        mode: 'free',
        elements: {
          'product-gallery': {
            aspectRatioLocked: true,
            widthPx: 640,
            heightPx: 360,
            responsive: {
              tablet: {
                widthPx: 480,
                heightPx: 270
              },
              mobile: {
                aspectRatioLocked: false,
                widthPx: 320,
                heightPx: 180
              }
            }
          }
        }
      }
    });

    expect(
      normalized.canvas.elements['product-gallery'].responsive.desktop
    ).toMatchObject({
      aspectRatioLocked: true,
      widthPx: 640,
      heightPx: 360
    });
    expect(
      normalized.canvas.elements['product-gallery'].responsive.tablet
    ).toMatchObject({
      aspectRatioLocked: true,
      widthPx: 480,
      heightPx: 270
    });
    expect(
      normalized.canvas.elements['product-gallery'].responsive.mobile
    ).toMatchObject({
      aspectRatioLocked: false,
      widthPx: 320,
      heightPx: 180
    });

    const stored = toStoredProductAppearanceConfig(normalized);
    const roundTrip = normalizeProductAppearanceConfig(stored);
    expect(roundTrip.canvas.elements['product-gallery']).toEqual(
      normalized.canvas.elements['product-gallery']
    );
  });
});
