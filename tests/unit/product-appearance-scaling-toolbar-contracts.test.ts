import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  normalizeProductAppearanceConfig,
  toStoredProductAppearanceConfig,
  type ProductCanvasElementDeviceSettings
} from '@/shared/domain/style/productAppearance';
import {
  isProductCanvasProportionalResizeElement,
  resolveProductCanvasProportionalResize
} from '@/shared/ui/product-canvas/ProductCanvasElement';

const source = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8'
);

const sourceAround = (
  value: string,
  marker: string,
  before = 500,
  after = 1_200
) => {
  const index = value.indexOf(marker);
  assert.notEqual(index, -1, `Expected source marker: ${marker}`);
  return value.slice(Math.max(0, index - before), index + marker.length + after);
};

const deviceSettings = (
  overrides: Partial<ProductCanvasElementDeviceSettings> = {}
): ProductCanvasElementDeviceSettings => ({
  ...DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
  ...overrides
});

describe('product appearance proportional scaling and toolbar contracts', () => {
  test('content scale defaults, normalizes, clamps, and round-trips per device', () => {
    assert.equal(DEFAULT_PRODUCT_APPEARANCE_CONFIG.schemaVersion, 10);
    assert.equal(
      DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS.contentScale,
      1
    );

    const normalized = normalizeProductAppearanceConfig({
      canvas: {
        elements: {
          'product-quantity-input': {
            responsive: {
              desktop: deviceSettings({ contentScale: 1.75 }),
              tablet: deviceSettings({ contentScale: 0.01 }),
              mobile: deviceSettings({ contentScale: 99 })
            }
          },
          'product-primary-action': {
            responsive: {
              desktop: {
                ...deviceSettings(),
                contentScale: 'not-a-number'
              }
            }
          }
        }
      }
    });

    const quantity = normalized.canvas.elements['product-quantity-input'];
    assert.equal(quantity.responsive.desktop.contentScale, 1.75);
    assert.equal(quantity.responsive.tablet.contentScale, 0.1);
    assert.equal(quantity.responsive.mobile.contentScale, 4);
    assert.equal(
      normalized.canvas.elements['product-primary-action']
        .responsive.desktop.contentScale,
      1
    );

    const stored = toStoredProductAppearanceConfig(normalized);
    assert.equal(
      stored.canvas.elements['product-quantity-input']
        .responsive.desktop.contentScale,
      1.75
    );
    assert.equal(
      stored.canvas.elements['product-quantity-input']
        .responsive.tablet.contentScale,
      0.1
    );
    assert.equal(
      stored.canvas.elements['product-quantity-input']
        .responsive.mobile.contentScale,
      4
    );
    assert.deepEqual(
      normalizeProductAppearanceConfig(stored).canvas.elements[
        'product-quantity-input'
      ].responsive,
      quantity.responsive
    );
  });

  test('proportional resize keeps geometry and visual content in lockstep', () => {
    assert.deepEqual(resolveProductCanvasProportionalResize({
      startWidth: 200,
      startHeight: 100,
      startContentScale: 1,
      nextWidth: 100,
      nextHeight: 100,
      axis: 'width'
    }), {
      widthPx: 100,
      heightPx: 50,
      contentScale: 0.5
    });

    assert.deepEqual(resolveProductCanvasProportionalResize({
      startWidth: 400,
      startHeight: 200,
      startContentScale: 1.5,
      nextWidth: 400,
      nextHeight: 300,
      axis: 'height'
    }), {
      widthPx: 600,
      heightPx: 300,
      contentScale: 2.25
    });

    assert.deepEqual(resolveProductCanvasProportionalResize({
      startWidth: 300,
      startHeight: 150,
      startContentScale: 0.8,
      nextWidth: 360,
      nextHeight: 300,
      axis: 'both'
    }), {
      widthPx: 600,
      heightPx: 300,
      contentScale: 1.6
    });
  });

  test('proportional resize respects element minimums and content-scale limits', () => {
    assert.deepEqual(resolveProductCanvasProportionalResize({
      startWidth: 200,
      startHeight: 100,
      startContentScale: 0.2,
      nextWidth: 1,
      nextHeight: 1,
      axis: 'both'
    }), {
      widthPx: 48,
      heightPx: 24,
      contentScale: 0.1
    });

    const minimumLimited = resolveProductCanvasProportionalResize({
      startWidth: 240,
      startHeight: 44,
      startContentScale: 1,
      nextWidth: 1,
      nextHeight: 1,
      axis: 'both',
      minimumWidth: 160,
      minimumHeight: 40
    });
    assert.deepEqual(minimumLimited, {
      widthPx: 218,
      heightPx: 40,
      contentScale: 218 / 240
    });

    assert.deepEqual(resolveProductCanvasProportionalResize({
      startWidth: 100,
      startHeight: 50,
      startContentScale: 2,
      nextWidth: 1_000,
      nextHeight: 500,
      axis: 'both'
    }), {
      widthPx: 1_000,
      heightPx: 500,
      contentScale: 4
    });
  });

  test('interactive subelements are classified for proportional resizing', () => {
    for (const elementId of [
      'product-gallery-thumbnails',
      'product-quantity-input',
      'product-secondary-tabs',
      'listing-view-grid',
      'product-variant-axis-1-control',
      'product-quantity-controls',
      'product-primary-action'
    ]) {
      assert.equal(
        isProductCanvasProportionalResizeElement(elementId),
        true,
        elementId
      );
    }

    assert.equal(isProductCanvasProportionalResizeElement('product-gallery'), false);
    assert.equal(isProductCanvasProportionalResizeElement('product-information'), false);
  });

  test('gallery content toolbar exposes layout controls and clears stale fixed size on orientation change', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const positionControl = sourceAround(
      toolbarSource,
      'testId="product-gallery-thumbnail-position"',
      850,
      900
    );

    for (const label of [
      'Levo · navpično',
      'Desno · navpično',
      'Zgoraj · vodoravno',
      'Spodaj · vodoravno',
      'Skrito'
    ]) {
      assert.match(positionControl, new RegExp(label, 'u'));
    }
    assert.match(
      positionControl,
      /previewDevice === 'desktop'[\s\S]*thumbnailPositionDesktop[\s\S]*thumbnailPositionMobile/u
    );
    assert.match(
      positionControl,
      /onElementCanvasChange\('product-gallery-thumbnails', \{[\s\S]*widthPx: 0,[\s\S]*heightPx: 0,[\s\S]*contentScale: 1/u
    );

    for (const testId of [
      'product-gallery-thumbnail-size',
      'product-gallery-thumbnail-gap',
      'product-gallery-hide-single-thumbnail'
    ]) {
      assert.match(toolbarSource, new RegExp(testId, 'u'));
    }
  });

  test('style settings use a wide horizontal surface while compact content keeps its viewport scroller', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const panelSource = sourceAround(
      toolbarSource,
      'data-product-toolbar-popover',
      700,
      1_300
    );

    assert.match(toolbarSource, /const stylePanelOpen = panel === 'style';/u);
    assert.match(panelSource, /data-settings-scroll=\{stylePanelOpen \? 'none' : 'internal'\}/u);
    assert.match(
      panelSource,
      /stylePanelOpen[\s\S]*?w-\[min\(760px,calc\(100dvw-16px\)\)\] overflow-hidden[\s\S]*?w-\[min\(400px,calc\(100vw-32px\)\)\] overflow-x-hidden overflow-y-auto overscroll-contain/u
    );
    assert.match(
      panelSource,
      /style=\{stylePanelOpen \? undefined : \{ maxHeight: panelLayout\.maxHeight \}\}/u
    );
    const styleSource = sourceAround(
      toolbarSource,
      'data-product-toolbar-style-layout="horizontal"',
      100,
      18_000
    );
    assert.match(styleSource, /md:grid-cols-\[minmax\(320px,0\.92fr\)_minmax\(360px,1\.08fr\)\]/u);
    assert.match(styleSource, /data-product-toolbar-style-controls/u);
    assert.match(styleSource, /data-product-toolbar-style-color-grid/u);
    assert.doesNotMatch(styleSource, /overflow-y-auto|maxHeight/u);
    const layoutSource = sourceAround(
      toolbarSource,
      "const preferredSide = toolbarPlacement",
      100,
      500
    );
    assert.match(layoutSource, /const side = preferredSide;/u);
    assert.match(
      layoutSource,
      /const maxHeight = Math\.max\(1, Math\.min\(desiredHeight, available\[side\]\)\);/u
    );
    assert.doesNotMatch(layoutSource, /alternateSide|minimumUsableHeight/u);
  });

  test('inherited font label reflects the actual global heading or body font', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );

    assert.match(toolbarSource, /globalStyle: GlobalStyleConfig/u);
    assert.match(
      toolbarSource,
      /const inheritedFontFamily = usesHeadingFont[\s\S]*globalStyle\.typography\.headingFontFamily[\s\S]*globalStyle\.typography\.bodyFontFamily/u
    );
    assert.match(
      toolbarSource,
      /\{ value: '', label: `\$\{inheritedFontFamily\} \(globalno\)` \}/u
    );

    const toolbarMount = sourceAround(
      editorSource,
      '<ProductAppearanceContextToolbar',
      100,
      1_500
    );
    assert.match(toolbarMount, /globalStyle=\{initialGlobalStyle\}/u);
  });

  test('layers dock owns ordering and parent dismissal clears selection', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const layersPanelSource = source(
      'src/admin/features/podoba/components/ProductAppearanceLayersPanel.tsx'
    );

    assert.doesNotMatch(toolbarSource, /changeLayerOrder|Premakni plast nazaj|Premakni plast naprej/u);
    assert.match(editorSource, /<ProductAppearanceLayersPanel/u);
    assert.match(editorSource, /items=\{productAppearanceLayerItems\}/u);
    assert.match(layersPanelSource, /DndContext/u);
    assert.match(layersPanelSource, /SortableContext/u);

    assert.match(
      editorSource,
      /const clearCanvasSelection = useCallback\(\(\) => \{\s*setSelectedCanvasElementIds\(\[\]\);/u
    );
    const floatingToolbarMount = sourceAround(
      editorSource,
      '<ProductAppearanceContextToolbar',
      500,
      500
    );
    assert.match(floatingToolbarMount, /onDismiss=\{clearCanvasSelection\}/u);
    const sharedToolbarSource = source(
      'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
    );
    assert.match(
      sharedToolbarSource,
      /\[data-product-canvas-element\][\s\S]*\[data-admin-color-palette-portal\][\s\S]*\[data-appearance-editor-compact-select-portal\]/u
    );
  });
});
