import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  cloneDefaultProductAppearanceConfig,
  normalizeProductAppearanceConfig,
  resolveProductCanvasElementDeviceSettings,
  toStoredProductAppearanceConfig,
  type ProductCanvasElementDeviceSettings
} from '@/shared/domain/style/productAppearance';
import { buildCatalogPresentationDetails } from '@/shared/domain/catalog/catalogPresentation';
import { PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS } from '@/shared/ui/product-canvas/ProductCanvasElement';

const deviceSettings = (
  overrides: Partial<ProductCanvasElementDeviceSettings> = {}
): ProductCanvasElementDeviceSettings => ({
  ...DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  ...overrides
});

describe('product appearance hybrid canvas contracts', () => {
  test('normalization supplies canvas defaults and accepts legacy flat element settings', () => {
    const defaults = normalizeProductAppearanceConfig({});

    expect(defaults.canvas).toEqual(DEFAULT_PRODUCT_APPEARANCE_CONFIG.canvas);
    expect(defaults.canvas).toMatchObject({
      mode: 'guided',
      gridSizePx: 8,
      snapToGrid: true,
      showGrid: false,
      showGuides: true,
      elements: {}
    });

    const normalized = normalizeProductAppearanceConfig({
      canvas: {
        gridSizePx: 1,
        elements: {
          'product-title': {
            visible: false,
            locked: true,
            offsetXPx: 17,
            fontSizePx: 31,
            textAlign: 'center',
            responsive: {
              tablet: {
                offsetXPx: 29
              }
            }
          }
        }
      }
    });

    expect(normalized.canvas.mode).toBe('guided');
    expect(normalized.canvas.gridSizePx).toBe(2);
    expect(normalized.canvas.elements['product-title'].responsive.desktop).toMatchObject({
      visible: false,
      locked: true,
      offsetXPx: 17,
      fontSizePx: 31,
      textAlign: 'center'
    });
    expect(normalized.canvas.elements['product-title'].responsive.tablet).toMatchObject({
      visible: false,
      locked: true,
      offsetXPx: 29,
      fontSizePx: 31,
      textAlign: 'center'
    });
    expect(normalized.canvas.elements['product-title'].responsive.mobile).toMatchObject({
      visible: false,
      locked: true,
      offsetXPx: 17,
      fontSizePx: 31,
      textAlign: 'center'
    });
  });

  test('stored configuration preserves free mode and canvas edits while omitting revision metadata', () => {
    const config = cloneDefaultProductAppearanceConfig();
    config.updatedAt = '2026-07-26T12:00:00.000Z';
    config.canvas = {
      mode: 'free',
      gridSizePx: 12,
      snapToGrid: false,
      showGrid: true,
      showGuides: false,
      elements: {
        'product-gallery': {
          responsive: {
            desktop: deviceSettings({
              offsetXPx: 24,
              widthPx: 560,
              borderRadiusPx: 18,
              shadow: 'md'
            }),
            tablet: deviceSettings({
              offsetXPx: 12,
              widthPx: 420,
              borderRadiusPx: 14,
              shadow: 'sm'
            }),
            mobile: deviceSettings({
              offsetYPx: 8,
              widthPx: 320,
              borderRadiusPx: 10
            })
          }
        }
      }
    };

    const stored = toStoredProductAppearanceConfig(config);

    expect(stored).not.toHaveProperty('updatedAt');
    expect(stored.canvas).toMatchObject({
      mode: 'free',
      gridSizePx: 12,
      snapToGrid: false,
      showGrid: true,
      showGuides: false
    });
    expect(stored.canvas.elements['product-gallery'].responsive.desktop).toMatchObject({
      offsetXPx: 24,
      widthPx: 560,
      borderRadiusPx: 18,
      shadow: 'md'
    });

    const roundTrip = normalizeProductAppearanceConfig(stored);
    expect(roundTrip.canvas).toEqual(config.canvas);
  });

  test('responsive element settings resolve independently for desktop, tablet, and mobile', () => {
    const config = normalizeProductAppearanceConfig({
      canvas: {
        mode: 'free',
        elements: {
          'product-price': {
            responsive: {
              desktop: deviceSettings({
                offsetXPx: 32,
                widthPx: 360,
                fontSizePx: 28,
                textAlign: 'right'
              }),
              tablet: deviceSettings({
                offsetXPx: 16,
                widthPx: 280,
                fontSizePx: 24,
                textAlign: 'center'
              }),
              mobile: deviceSettings({
                offsetXPx: 0,
                offsetYPx: 10,
                widthPx: 0,
                fontSizePx: 20,
                textAlign: 'left'
              })
            }
          }
        }
      }
    });

    expect(resolveProductCanvasElementDeviceSettings(config, 'product-price', 'desktop')).toMatchObject({
      offsetXPx: 32,
      widthPx: 360,
      fontSizePx: 28,
      textAlign: 'right'
    });
    expect(resolveProductCanvasElementDeviceSettings(config.canvas, 'product-price', 'tablet')).toMatchObject({
      offsetXPx: 16,
      widthPx: 280,
      fontSizePx: 24,
      textAlign: 'center'
    });

    const mobile = resolveProductCanvasElementDeviceSettings(config, 'product-price', 'mobile');
    expect(mobile).toMatchObject({
      offsetXPx: 0,
      offsetYPx: 10,
      widthPx: 0,
      fontSizePx: 20,
      textAlign: 'left'
    });

    mobile.offsetYPx = 999;
    expect(
      resolveProductCanvasElementDeviceSettings(config, 'product-price', 'mobile').offsetYPx
    ).toBe(10);
    expect(
      resolveProductCanvasElementDeviceSettings(config, 'missing-element', 'desktop')
    ).toEqual(DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS);
  });

  test('upgrades only the legacy oversized product-title baseline', () => {
    const legacy = normalizeProductAppearanceConfig({
      canvas: {
        mode: 'free',
        elements: {
          'product-title': {
            fontSizePx: 44
          },
          'product-short-description': {
            fontSizePx: 44
          }
        }
      }
    });

    for (const device of ['desktop', 'tablet', 'mobile'] as const) {
      expect(
        legacy.canvas.elements['product-title'].responsive[device].fontSizePx
      ).toBe(40);
      expect(
        legacy.canvas.elements['product-short-description'].responsive[device]
          .fontSizePx
      ).toBe(44);
    }

    const authored = normalizeProductAppearanceConfig({
      schemaVersion: 2,
      canvas: {
        elements: {
          'product-title': {
            fontSizePx: 44
          }
        }
      }
    });
    expect(
      authored.canvas.elements['product-title'].responsive.desktop.fontSizePx
    ).toBe(44);
  });

  test('normalization keeps a fixed primary action large enough to remain usable', () => {
    const normalized = normalizeProductAppearanceConfig({
      schemaVersion: 2,
      canvas: {
        mode: 'free',
        elements: {
          'product-primary-action': {
            widthPx: 1,
            heightPx: 1
          }
        }
      }
    });

    for (const device of ['desktop', 'tablet', 'mobile'] as const) {
      expect(
        normalized.canvas.elements['product-primary-action'].responsive[device]
      ).toMatchObject({ widthPx: 160, heightPx: 40 });
    }
    expect(
      normalizeProductAppearanceConfig(
        toStoredProductAppearanceConfig(normalized)
      ).canvas.elements['product-primary-action']
    ).toEqual(normalized.canvas.elements['product-primary-action']);
  });

  test('commerce-critical canvas elements remain protected', () => {
    expect([...PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS]).toEqual([
      'product-purchase',
      'product-price',
      'product-primary-action',
      'cart-summary',
      'cart-primary-action'
    ]);
    expect(PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has('product-title')).toBe(false);
    expect(PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has('product-gallery')).toBe(false);
  });

  test('appearance preview uses the same type-specific presentation details as the catalogue', () => {
    const dimensions = buildCatalogPresentationDetails('dimensions', {
      dimensions: {
        defaultDeliveryTime: '1-2 delovna dneva'
      }
    });
    const machine = buildCatalogPresentationDetails('unique_machine', {
      uniqueMachine: {
        deliveryTime: '3-5 delovnih dni',
        specs: [
          { property: 'Moč', value: '205', unit: 'W' }
        ],
        includedItems: ['Osnovna enota', 'Navodila']
      }
    });

    expect(dimensions.deliveryEstimate).toBe('1-2 delovna dneva');
    expect(machine).toMatchObject({
      deliveryEstimate: '3-5 delovnih dni',
      includedItems: ['Osnovna enota', 'Navodila'],
      specifications: [
        expect.objectContaining({
          label: 'Moč',
          value: '205 W'
        })
      ]
    });
  });

  test('editor source exposes a real-product interactive canvas and contextual tools', () => {
    const editorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
      ),
      'utf8'
    );
    const toolbarSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
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
    const previewProductSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/lib/productAppearancePreviewProduct.ts'
      ),
      'utf8'
    );
    const productDetailSource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/ProductDetailView.tsx'
      ),
      'utf8'
    );
    const variantSelectorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/commercial/components/storefront/VariantSelector.tsx'
      ),
      'utf8'
    );
    const canvasElementSource = readFileSync(
      resolve(
        process.cwd(),
        'src/shared/ui/product-canvas/ProductCanvasElement.tsx'
      ),
      'utf8'
    );
    const guideOverlaySource = readFileSync(
      resolve(
        process.cwd(),
        'src/shared/ui/product-canvas/ProductCanvasGuidesOverlay.tsx'
      ),
      'utf8'
    );
    const appearancePageSource = readFileSync(
      resolve(process.cwd(), 'src/admin/pages/podoba/artikli/page.tsx'),
      'utf8'
    );
    const scaleFrameSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/CommercialScaleFrame.tsx'),
      'utf8'
    );
    const stylesSource = readFileSync(
      resolve(process.cwd(), 'src/shared/styles/globals.css'),
      'utf8'
    );

    expect(editorSource).toContain("config.canvas.mode === 'free'");
    expect(editorSource).toContain('Artikel v predogledu');
    expect(editorSource).toContain('Napredne privzete nastavitve');
    expect(editorSource).toContain('ProductAppearanceLivePreview');
    expect(editorSource).toContain('ProductAppearanceContextToolbar');
    expect(editorSource).toContain('buildProductAppearancePreviewProduct');
    expect(editorSource).toContain('resolveProductCanvasElementDeviceSettings');

    expect(toolbarSource).toContain('Slog · vsi artikli');
    expect(toolbarSource).toContain('Vsebina');
    expect(toolbarSource).toContain('Galerija artikla');
    expect(livePreviewSource).toContain('<ProductDetailView');
    expect(livePreviewSource).toContain('data-admin-product-live-preview');
    expect(livePreviewSource).toContain('<ProductCanvasGuidesOverlay');
    expect(livePreviewSource).toContain('toCommercialStorefrontLogicalPx');
    expect(livePreviewSource).toContain('siteLayout.siteContentMaxWidthPx');
    expect(livePreviewSource).toContain('product={product}');
    expect(livePreviewSource).not.toContain("mode: 'free' as const");
    expect(previewProductSource).toContain('buildCatalogPresentationDetails');
    expect(previewProductSource).toContain('subcategoryTitle');
    expect(productDetailSource).toContain(
      "const canvasActive = appearance.canvas?.mode === 'free';"
    );
    expect(productDetailSource).toContain(
      'if (!canvasActive && !canvasEditor) return children;'
    );
    expect(productDetailSource).toContain('active={canvasActive}');
    expect(productDetailSource).toContain('storefront-product-title');
    expect(productDetailSource).toContain(
      'canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}'
    );
    expect(productDetailSource).toContain("'product-secondary-tabs'");
    expect(productDetailSource).toContain(
      '`product-secondary-tab-${section.id}`'
    );
    expect(productDetailSource).toContain(
      '`product-${section.id}-heading`'
    );
    expect(productDetailSource).toContain(
      '`product-${section.id}-content`'
    );

    expect(editorSource).toContain("id: 'product-variant-thickness-options'");
    expect(editorSource).toContain("id: 'product-variant-dimensions-control'");
    expect(variantSelectorSource).toContain("'product-variant-thickness'");
    expect(variantSelectorSource).toContain("'product-variant-thickness-options'");
    expect(variantSelectorSource).toContain("'product-variant-dimensions'");
    expect(variantSelectorSource).toContain("'product-variant-dimensions-control'");
    expect(variantSelectorSource).toContain('const axisCanvasId = `product-variant-axis-${axisIndex + 1}`');
    expect(variantSelectorSource).toContain('resolveProductCanvasElementDeviceSettings');
    expect(toolbarSource).toContain('data-testid="product-canvas-offset-x"');
    expect(toolbarSource).toContain('data-testid="product-canvas-offset-y"');

    expect(canvasElementSource).toContain('data-product-canvas-element={elementId}');
    expect(canvasElementSource).toContain("maxWidth: '100%'");
    expect(canvasElementSource).toContain('data-product-canvas-selected={selected || undefined}');
    expect(canvasElementSource).toContain('data-product-canvas-resize');
    expect(canvasElementSource).toContain('data-product-canvas-move-handle');
    expect(canvasElementSource).toContain('handleMoveKeyDown');
    expect(canvasElementSource).toContain(
      'h-full overflow-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
    );
    expect(guideOverlaySource).toContain('data-product-editor-aid="guides"');
    expect(guideOverlaySource).toContain('data-product-editor-aid="measurements"');
    expect(guideOverlaySource).toContain('Najbližje:');
    expect(appearancePageSource).toContain('getSiteNavigationConfig()');
    expect(appearancePageSource).toContain('initialSiteLayout={navigation.siteLayout}');
    expect(scaleFrameSource).toContain(
      'toCommercialStorefrontLogicalPx(siteLayout.siteContentMaxWidthPx)'
    );
    expect(stylesSource).toMatch(
      /\.storefront-product-page\s*\{[^}]*overflow-x:\s*clip;/s
    );
    expect(stylesSource).toMatch(
      /\.storefront-product-page\s*\{[^}]*max-width:\s*min\([\s\S]*?var\(--site-content-max-width\)/s
    );
  });
});
