import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentTextAlignmentOverride,
  normalizeOrderDocumentTemplate,
  resetOrderDocumentTableBorders,
  resolveOrderDocumentTableBorders,
  resolveOrderDocumentTextAlignment,
  setOrderDocumentTableBorders,
  setOrderDocumentTextAlignment,
  type OrderDocumentTextAlignment,
  type OrderDocumentTypographyTarget
} from '../../src/shared/domain/order/orderDocumentTemplates';

const quickStyleSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/urejevalnik/components/OrderDocumentTableQuickStyleControls.tsx'
), 'utf8');

test('every table text scope stores and resolves its own alignment override', () => {
  const edits: readonly [OrderDocumentTypographyTarget, OrderDocumentTextAlignment][] = [
    [{ kind: 'table_header' }, 'right'],
    [{ kind: 'table_body' }, 'justify'],
    [{ kind: 'table_column', columnId: 'lineTotal' }, 'center'],
    [{ kind: 'table_row', rowNumber: 2 }, 'left'],
    [{ kind: 'table_header_cell', columnId: 'description' }, 'center'],
    [{ kind: 'table_cell', rowNumber: 2, columnId: 'lineTotal' }, 'right']
  ];

  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  for (const [target, alignment] of edits) {
    template = setOrderDocumentTextAlignment(template, target, alignment);
  }
  template = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template)) as unknown
  );

  for (const [target, alignment] of edits) {
    assert.equal(getOrderDocumentTextAlignmentOverride(template, target), alignment);
    assert.equal(resolveOrderDocumentTextAlignment(template, target), alignment);
  }
  assert.equal(
    getOrderDocumentTextAlignmentOverride(template, {
      kind: 'table_cell',
      rowNumber: 1,
      columnId: 'lineTotal'
    }),
    undefined,
    'an exact-cell edit must not leak into a sibling row'
  );
});

test('all table border controls persist together and reset to inherited defaults', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTableBorders(template, {
    outer: true,
    horizontal: true,
    vertical: true,
    color: '#2468AC',
    widthPt: 2.25
  });
  template = normalizeOrderDocumentTemplate(
    'order_summary',
    JSON.parse(JSON.stringify(template)) as unknown
  );

  assert.deepEqual(resolveOrderDocumentTableBorders(template), {
    outer: true,
    horizontal: true,
    vertical: true,
    color: '#2468AC',
    widthPt: 2.25
  });

  template = resetOrderDocumentTableBorders(template);
  assert.deepEqual(resolveOrderDocumentTableBorders(template), {
    outer: false,
    horizontal: false,
    vertical: false,
    color: template.style.lineColor,
    widthPt: template.style.lineWidthPt
  });
});

test('quick table style surface exposes scopes, direct alignment, and immediate borders', () => {
  assert.match(quickStyleSource, /data-order-document-table-quick-style/u);
  assert.match(quickStyleSource, /data-settings-scroll="none"/u);
  assert.doesNotMatch(quickStyleSource, /overflow-(?:x|y|auto|scroll)/u);
  assert.doesNotMatch(quickStyleSource, /<select\b/u);

  for (const label of ['Glava', 'Vrstice', 'Stolpec', 'Vrstica', 'Celica']) {
    assert.ok(quickStyleSource.includes(`${label}`), `Missing table scope ${label}`);
  }
  for (const scope of ['header', 'body', 'column', 'row', 'cell']) {
    assert.ok(
      quickStyleSource.includes(`data-order-document-table-quick-scope={scope}`)
        || quickStyleSource.includes(`'${scope}'`),
      `Missing quick table scope identity ${scope}`
    );
  }
  assert.match(quickStyleSource, /role="radiogroup"/u);
  assert.match(quickStyleSource, /role="radio"/u);
  assert.match(quickStyleSource, /aria-checked/u);
  assert.match(quickStyleSource, /event\.ctrlKey \|\| event\.metaKey/u);
  assert.match(quickStyleSource, /Navaden klik zamenja obseg/u);
  assert.match(quickStyleSource, /Ctrl\/Cmd \+ klik/u);

  for (const alignment of ['automatic', 'left', 'center', 'right', 'justify']) {
    assert.ok(
      quickStyleSource.includes(`data-order-document-table-alignment`)
        && quickStyleSource.includes(alignment),
      `Missing alignment ${alignment}`
    );
  }
  assert.match(quickStyleSource, /setOrderDocumentTextAlignment/u);
  assert.match(quickStyleSource, /resetOrderDocumentTextAlignment/u);

  for (const border of ['outer', 'horizontal', 'vertical']) {
    assert.ok(quickStyleSource.includes(`'${border}'`), `Missing border ${border}`);
  }
  assert.match(quickStyleSource, /CompactHexColorField/u);
  assert.match(quickStyleSource, /order-document-table-quick-border-width/u);
  assert.match(quickStyleSource, /setOrderDocumentTableBorders/u);
  assert.match(quickStyleSource, /resetOrderDocumentTableBorders/u);
});
