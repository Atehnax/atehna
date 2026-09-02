import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX,
  PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX,
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

describe('product canvas dimension resizing', () => {
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

    // Every runtime layer resolves the same responsive device settings object
    // used by the contextual toolbar and the docked layers panel.
    expect(editorSource).toContain(
      'const productAppearanceLayerItems = useMemo<ProductAppearanceLayerItem[]>'
    );
    expect(editorSource).toContain(
      'settings: resolveProductCanvasElementDeviceSettings(config, layer.id, previewDevice)'
    );
    expect(editorSource).toContain('<ProductAppearanceLayersPanel');
    expect(editorSource).toContain('items={productAppearanceLayerItems}');
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

  test('primary action resizing keeps the button usable', () => {
    expect(resolveProductCanvasResize({
      startWidth: 240,
      startHeight: 44,
      nextWidth: 20,
      nextHeight: 10,
      axis: 'both',
      aspectRatioLocked: false,
      minimumWidth: PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX,
      minimumHeight: PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX
    })).toEqual({
      widthPx: 160,
      heightPx: 40
    });

    const locked = resolveProductCanvasResize({
      startWidth: 240,
      startHeight: 44,
      nextWidth: 160,
      nextHeight: 44,
      axis: 'width',
      aspectRatioLocked: true,
      minimumWidth: PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX,
      minimumHeight: PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX
    });
    expect(locked).toEqual({ widthPx: 219, heightPx: 40 });
    expect(locked.widthPx! / locked.heightPx!).toBeCloseTo(240 / 44, 1);
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
            responsive: {
              desktop: {
                aspectRatioLocked: true,
                widthPx: 640,
                heightPx: 360
              },
              tablet: {
                aspectRatioLocked: true,
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
