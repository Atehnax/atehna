import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampOrderDocumentFieldRowToPage,
  clampOrderDocumentMoveWithDependents,
  clampOrderDocumentRectToPage,
  resolveOrderDocumentFieldRowPageBounds,
  resolveOrderDocumentMoveWithDependentsBounds,
  resolveOrderDocumentPointerDragPosition
} from '../../src/admin/features/urejevalnik/lib/orderDocumentDragGeometry';

const A4_PAGE = { widthMm: 210, heightMm: 297 } as const;

test('pointer movement is resolved from an immutable origin and reverses without accumulated drift', () => {
  const frame = (clientX: number, clientY: number) => resolveOrderDocumentPointerDragPosition({
    startXmm: 50,
    startYmm: 80,
    startClientX: 100,
    startClientY: 100,
    clientX,
    clientY,
    pagePixelWidth: 420,
    pagePixelHeight: 594,
    page: A4_PAGE
  });

  assert.deepEqual(frame(180, 160), { xMm: 90, yMm: 110 });
  assert.deepEqual(frame(40, 20), { xMm: 20, yMm: 40 });
  assert.deepEqual(
    frame(100, 100),
    { xMm: 50, yMm: 80 },
    'returning the pointer to its start must restore the exact drag origin'
  );
});

test('top-level rectangles move freely in every direction while remaining fully on the page', () => {
  const source = { xMm: 35, yMm: 60, widthMm: 50, heightMm: 20 };
  assert.deepEqual(
    clampOrderDocumentRectToPage({ ...source, xMm: -25, yMm: -30 }, A4_PAGE),
    { ...source, xMm: 0, yMm: 0 }
  );
  assert.deepEqual(
    clampOrderDocumentRectToPage({ ...source, xMm: 500, yMm: 500 }, A4_PAGE),
    { ...source, xMm: 160, yMm: 277 }
  );
  assert.deepEqual(clampOrderDocumentRectToPage(source, A4_PAGE), source);
});

test('semantic-row bounds are page-relative and permit signed owner-relative offsets', () => {
  const owner = { xMm: 28, yMm: 52 };
  const row = { widthMm: 42, heightMm: 8 };
  assert.deepEqual(
    resolveOrderDocumentFieldRowPageBounds(owner, row, A4_PAGE),
    {
      minXmm: -28,
      maxXmm: 140,
      minYmm: -52,
      maxYmm: 237
    }
  );

  assert.deepEqual(
    clampOrderDocumentFieldRowToPage(
      { xMm: -500, yMm: -500 },
      owner,
      row,
      A4_PAGE
    ),
    { xMm: -28, yMm: -52 }
  );
  assert.deepEqual(
    clampOrderDocumentFieldRowToPage(
      { xMm: 500, yMm: 500 },
      owner,
      row,
      A4_PAGE
    ),
    { xMm: 140, yMm: 237 }
  );
});

test('oversized rows use ordered page-safe bounds instead of producing inverted clamps', () => {
  const owner = { xMm: 20, yMm: 30 };
  const oversized = { widthMm: 240, heightMm: 330 };
  const bounds = resolveOrderDocumentFieldRowPageBounds(owner, oversized, A4_PAGE);

  assert.deepEqual(bounds, {
    minXmm: -20,
    maxXmm: -20,
    minYmm: -30,
    maxYmm: -30
  });
  assert.deepEqual(
    clampOrderDocumentFieldRowToPage(
      { xMm: 50, yMm: 50 },
      owner,
      oversized,
      A4_PAGE
    ),
    { xMm: -20, yMm: -30 }
  );
});

test('group movement clamps the shared union without destroying dependent offsets', () => {
  const moving = { xMm: 30, yMm: 40, widthMm: 80, heightMm: 40 };
  const dependents = [
    { xMm: 20, yMm: 45, widthMm: 20, heightMm: 10 },
    { xMm: 100, yMm: 75, widthMm: 30, heightMm: 20 }
  ];

  assert.deepEqual(
    resolveOrderDocumentMoveWithDependentsBounds(moving, dependents, A4_PAGE),
    { minXmm: 10, maxXmm: 110, minYmm: 0, maxYmm: 242 }
  );
  assert.deepEqual(
    clampOrderDocumentMoveWithDependents(
      { xMm: 500, yMm: 500 },
      moving,
      dependents,
      A4_PAGE
    ),
    { xMm: 110, yMm: 242 }
  );
});

test('a page-clamped group move and its reverse preserve every original rectangle', () => {
  const start = { xMm: 30, yMm: 40, widthMm: 80, heightMm: 40 };
  const startDependents = [
    { xMm: 20, yMm: 45, widthMm: 20, heightMm: 10 },
    { xMm: 100, yMm: 75, widthMm: 30, heightMm: 20 }
  ];
  const outward = clampOrderDocumentMoveWithDependents(
    { xMm: 500, yMm: 500 },
    start,
    startDependents,
    A4_PAGE
  );
  const outwardDelta = {
    xMm: outward.xMm - start.xMm,
    yMm: outward.yMm - start.yMm
  };
  const moved = { ...start, ...outward };
  const movedDependents = startDependents.map((rect) => ({
    ...rect,
    xMm: rect.xMm + outwardDelta.xMm,
    yMm: rect.yMm + outwardDelta.yMm
  }));

  const returned = clampOrderDocumentMoveWithDependents(
    { xMm: start.xMm, yMm: start.yMm },
    moved,
    movedDependents,
    A4_PAGE
  );
  const returnDelta = {
    xMm: returned.xMm - moved.xMm,
    yMm: returned.yMm - moved.yMm
  };
  const returnedDependents = movedDependents.map((rect) => ({
    ...rect,
    xMm: rect.xMm + returnDelta.xMm,
    yMm: rect.yMm + returnDelta.yMm
  }));

  assert.deepEqual({ ...moved, ...returned }, start);
  assert.deepEqual(returnedDependents, startDependents);
});
