import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  moveSelectedProductAppearanceLayers,
  rankProductAppearanceLayersTopFirst
} from '@/admin/features/podoba/components/ProductAppearanceLayersPanel';
import {
  getProductCanvasElementStyle
} from '@/shared/ui/product-canvas/ProductCanvasElement';
import {
  DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS
} from '@/shared/domain/style/productAppearance';


const source = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8'
);

describe('product appearance layer ordering', () => {
  test('moves one layer down in a topmost-first sibling list', () => {
    assert.deepEqual(
      moveSelectedProductAppearanceLayers(
        ['top', 'middle', 'bottom'],
        'top',
        'middle'
      ),
      ['middle', 'top', 'bottom']
    );
  });

  test('moves one layer up in a topmost-first sibling list', () => {
    assert.deepEqual(
      moveSelectedProductAppearanceLayers(
        ['top', 'middle', 'bottom'],
        'bottom',
        'top'
      ),
      ['bottom', 'top', 'middle']
    );
  });

  test('maps the topmost-first order to unique descending persisted z-indexes', () => {
    assert.deepEqual(
      rankProductAppearanceLayersTopFirst(['raised', 'middle', 'lower']),
      [
        { id: 'raised', zIndex: 3 },
        { id: 'middle', zIndex: 2 },
        { id: 'lower', zIndex: 1 }
      ]
    );
  });

  test('each active canvas wrapper establishes its hierarchy-local stacking context', () => {
    const style = getProductCanvasElementStyle({
      ...DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS,
      zIndex: 0
    }, true, false);

    assert.equal(style.position, 'relative');
    assert.equal(style.isolation, 'isolate');
    assert.equal(style.zIndex, 0);
  });

  test('moves a selected block while preserving its internal order', () => {
    assert.deepEqual(
      moveSelectedProductAppearanceLayers(
        ['top', 'selected-a', 'selected-b', 'bottom'],
        'selected-a',
        'bottom',
        ['selected-a', 'selected-b']
      ),
      ['top', 'bottom', 'selected-a', 'selected-b']
    );

    assert.deepEqual(
      moveSelectedProductAppearanceLayers(
        ['top', 'selected-a', 'selected-b', 'bottom'],
        'selected-b',
        'top',
        ['selected-a', 'selected-b']
      ),
      ['selected-a', 'selected-b', 'top', 'bottom']
    );
  });

  test('does not reorder when the drop target belongs to the moving block', () => {
    const layers = ['top', 'selected-a', 'selected-b', 'bottom'];

    assert.deepEqual(
      moveSelectedProductAppearanceLayers(
        layers,
        'selected-a',
        'selected-b',
        ['selected-a', 'selected-b']
      ),
      layers
    );
  });

  test('the full layer title surface drags and fixed-height content remains paintable', () => {
    const panelSource = source(
      'src/admin/features/podoba/components/ProductAppearanceLayersPanel.tsx'
    );
    const canvasSource = source(
      'src/shared/ui/product-canvas/ProductCanvasElement.tsx'
    );

    assert.match(panelSource, /Izberi ali premakni plast/u);
    assert.match(panelSource, /col-span-2[\s\S]*cursor-grab/u);
    assert.match(panelSource, /\.\.\.listeners/u);
    assert.match(canvasSource, /data-product-canvas-content-overflow/u);
    assert.match(canvasSource, /product-canvas-element-content h-full overflow-visible/u);
    assert.doesNotMatch(canvasSource, /product-canvas-element-content h-full overflow-auto/u);
  });
});
