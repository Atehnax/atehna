import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  resolveOrderDocumentCanvasAlignment,
  type OrderDocumentAlignmentRect
} from '../../src/admin/features/urejevalnik/lib/orderDocumentCanvasAlignment';

const PAGE = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  pageMarginMm: 10
};

function moving(overrides: Partial<OrderDocumentAlignmentRect> = {}): OrderDocumentAlignmentRect {
  return {
    id: 'moving',
    xMm: 40,
    yMm: 40,
    widthMm: 20,
    heightMm: 10,
    ...overrides
  };
}

test('alignment resolver suggests page content margins and page centres', () => {
  const left = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 10.9 }),
    targets: []
  });
  assert.equal(left.xMm, 10);
  assert.deepEqual(
    left.guides.map((guide) => [guide.axis, guide.targetId, guide.movingAnchor]),
    [['x', 'page-margin-left', 'left']]
  );

  const centre = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 94.2, widthMm: 20 }),
    targets: []
  });
  assert.equal(centre.xMm, 95);
  assert.equal(centre.guides[0]?.targetId, 'page-center-x');
  assert.equal(centre.guides[0]?.label, 'Vodoravna sredina strani');
});

test('alignment resolver exposes element edge and centre anchors as guide metadata', () => {
  const target = moving({
    id: 'company',
    label: 'Podatki podjetja',
    xMm: 80,
    yMm: 90,
    widthMm: 30,
    heightMm: 20
  });
  const result = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 84.4, yMm: 94.3, widthMm: 20, heightMm: 10 }),
    targets: [target]
  });

  assert.deepEqual({ xMm: result.xMm, yMm: result.yMm }, { xMm: 85, yMm: 95 });
  assert.deepEqual(
    result.guides.map((guide) => ({
      axis: guide.axis,
      movingAnchor: guide.movingAnchor,
      targetAnchor: guide.targetAnchor,
      targetId: guide.targetId
    })),
    [
      { axis: 'x', movingAnchor: 'center', targetAnchor: 'center', targetId: 'company' },
      { axis: 'y', movingAnchor: 'middle', targetAnchor: 'middle', targetId: 'company' }
    ]
  );
  assert.match(result.guides[0]?.label ?? '', /Podatki podjetja/u);
});

test('alignment resolver supports adjacent edges while preferring same-anchor ties', () => {
  const target = moving({ id: 'target', xMm: 50, yMm: 120, widthMm: 20, heightMm: 10 });
  const adjacent = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 29.2, yMm: 40 }),
    targets: [target]
  });

  assert.equal(adjacent.xMm, 30);
  assert.equal(adjacent.guides[0]?.movingAnchor, 'right');
  assert.equal(adjacent.guides[0]?.targetAnchor, 'left');
  assert.match(adjacent.guides[0]?.label ?? '', /desni rob.*levi rob/u);
});

test('alignment suggestions are stateless and immediately escapable outside the threshold', () => {
  const target = moving({ id: 'target', xMm: 80, yMm: 120, widthMm: 20, heightMm: 10 });
  const near = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 79.1 }),
    targets: [target]
  });
  assert.equal(near.xMm, 80);
  assert.ok(near.guides.some((guide) => guide.axis === 'x'));

  const escaped = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 77.9 }),
    targets: [target]
  });
  assert.equal(escaped.xMm, 77.9);
  assert.equal(escaped.guides.length, 0);
});

test('alignment guides remain advisory when magnetic snapping is disabled', () => {
  const rawX = 79.1;
  const result = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: rawX }),
    targets: [moving({ id: 'target', xMm: 80, yMm: 120 })],
    snap: false
  });

  assert.equal(result.xMm, rawX);
  assert.ok(result.guides.some((guide) => guide.axis === 'x'));
});

test('alignment resolver ignores hidden and moving-element targets', () => {
  const result = resolveOrderDocumentCanvasAlignment({
    ...PAGE,
    moving: moving({ xMm: 79.2 }),
    targets: [
      moving({ id: 'hidden', xMm: 80, visible: false }),
      moving({ id: 'moving', xMm: 80 })
    ]
  });

  assert.equal(result.xMm, 79.2);
  assert.equal(result.guides.length, 0);
});

test('canvas renders labelled, pointer-transparent, accessible editor-only drop suggestions', () => {
  const canvasSource = readFileSync(resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ), 'utf8');
  const pdfSource = readFileSync(resolve(process.cwd(), 'src/shared/server/pdf.ts'), 'utf8');

  for (const marker of [
    'data-order-document-alignment-guides',
    'data-order-document-alignment-guide={guide.axis}',
    'data-order-document-alignment-guide-label',
    'data-order-document-alignment-target={guide.targetId}',
    'data-order-document-alignment-mode={canvas.snapToElements',
    'data-order-document-drop-zone',
    'data-testid="order-document-alignment-guide-status"'
  ]) {
    assert.ok(canvasSource.includes(marker), `Missing alignment marker: ${marker}`);
  }
  assert.match(canvasSource, /pointer-events-none/u);
  assert.match(canvasSource, /role="status"/u);
  assert.match(canvasSource, /aria-live="polite"/u);
  assert.match(canvasSource, /Predlagana poravnava:/u);
  assert.doesNotMatch(pdfSource, /orderDocumentCanvasAlignment/u);
});
