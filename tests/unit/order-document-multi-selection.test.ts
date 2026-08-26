import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOrderDocumentTextAlignmentToTargets,
  applyOrderDocumentTypographyToTargets,
  orderDocumentChildSelection,
  orderDocumentElementSelection,
  reduceOrderDocumentCanvasSelection,
  resetOrderDocumentTextAlignmentTargets,
  resetOrderDocumentTypographyTargets,
  resolveOrderDocumentMixedTextAlignment,
  resolveOrderDocumentMixedTypography,
  resolveOrderDocumentSelectionTypographyTargets,
  type OrderDocumentCanvasChildSelection
} from '../../src/admin/features/urejevalnik/lib/orderDocumentCanvasSelection';
import {
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentTextAlignmentOverride,
  getOrderDocumentTypographyOverride,
  resolveOrderDocumentTextAlignment,
  setOrderDocumentTextAlignment,
  setOrderDocumentTypography
} from '../../src/shared/domain/order/orderDocumentTemplates';

const headerCell = (column: 'sku' | 'lineTotal'): OrderDocumentCanvasChildSelection => ({
  id: `items:table-header-cell:${column}`,
  parentId: 'items',
  kind: 'table_header_cell',
  key: column
});

const bodyCell = (
  rowNumber: number,
  column: 'sku' | 'lineTotal'
): OrderDocumentCanvasChildSelection => ({
  id: `items:table-cell:${rowNumber}:${column}`,
  parentId: 'items',
  kind: 'table_cell',
  rowNumber,
  key: column
});

test('ordinary selection replaces while Ctrl/Cmd additive selection toggles without duplicates', () => {
  const title = orderDocumentElementSelection('title');
  const totals = orderDocumentElementSelection('totals');
  const lineTotalHeader = orderDocumentChildSelection(headerCell('lineTotal'));

  let selection = reduceOrderDocumentCanvasSelection([], {
    type: 'replace',
    entry: title
  });
  assert.deepEqual(selection.map((entry) => entry.key), ['element:title']);

  selection = reduceOrderDocumentCanvasSelection(selection, {
    type: 'toggle',
    entry: totals
  });
  selection = reduceOrderDocumentCanvasSelection(selection, {
    type: 'toggle',
    entry: lineTotalHeader
  });
  assert.deepEqual(
    selection.map((entry) => entry.key),
    [
      'element:title',
      'element:totals',
      'child:items:table-header-cell:lineTotal'
    ],
    'additive selection must include top-level elements and exact table cells'
  );

  selection = reduceOrderDocumentCanvasSelection(selection, {
    type: 'toggle',
    entry: totals
  });
  assert.deepEqual(
    selection.map((entry) => entry.key),
    ['element:title', 'child:items:table-header-cell:lineTotal'],
    'toggling an existing target must remove only that target'
  );

  selection = reduceOrderDocumentCanvasSelection(selection, {
    type: 'replace',
    entry: totals
  });
  assert.deepEqual(selection, [totals]);
});

test('selection identity is stable by key and clear removes every target', () => {
  const first = orderDocumentChildSelection(headerCell('lineTotal'));
  const equivalent = orderDocumentChildSelection(headerCell('lineTotal'));

  let selection = reduceOrderDocumentCanvasSelection([first], {
    type: 'toggle',
    entry: equivalent
  });
  assert.deepEqual(selection, [], 'equivalent targets must toggle rather than duplicate');

  selection = reduceOrderDocumentCanvasSelection(
    [orderDocumentElementSelection('title'), orderDocumentElementSelection('totals')],
    { type: 'clear' }
  );
  assert.deepEqual(selection, []);
});

test('batch typography maps all compatible elements and exact cells while skipping non-text groups', () => {
  const entries = [
    orderDocumentElementSelection('logo'),
    orderDocumentElementSelection('document_details'),
    orderDocumentElementSelection('title'),
    orderDocumentChildSelection({
      id: 'title:text:title',
      parentId: 'title',
      kind: 'text',
      key: 'title'
    }),
    orderDocumentChildSelection(headerCell('lineTotal')),
    orderDocumentChildSelection(bodyCell(2, 'lineTotal'))
  ];
  const targets = resolveOrderDocumentSelectionTypographyTargets(entries);
  assert.deepEqual(targets, [
    { kind: 'element', elementId: 'title' },
    { kind: 'table_header_cell', columnId: 'lineTotal' },
    { kind: 'table_cell', rowNumber: 2, columnId: 'lineTotal' }
  ]);

  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = applyOrderDocumentTypographyToTargets(template, targets, {
    fontWeight: 'semibold'
  });
  for (const target of targets) {
    assert.deepEqual(getOrderDocumentTypographyOverride(template, target), {
      fontWeight: 'semibold'
    });
  }
  assert.equal(getOrderDocumentTypographyOverride(template, {
    kind: 'element',
    elementId: 'logo'
  }), undefined);

  template = resetOrderDocumentTypographyTargets(template, targets);
  for (const target of targets) {
    assert.equal(getOrderDocumentTypographyOverride(template, target), undefined);
  }
});

test('batch typography reports mixed fields and converges only the edited field', () => {
  const targets = [
    { kind: 'element', elementId: 'title' } as const,
    { kind: 'table_cell', rowNumber: 1, columnId: 'sku' } as const
  ];
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = setOrderDocumentTypography(template, targets[0], {
    fontFamily: 'barlow',
    fontWeight: 'bold',
    fontSizePt: 15
  });
  template = setOrderDocumentTypography(template, targets[1], {
    fontFamily: 'barlow',
    fontWeight: 'regular',
    fontSizePt: 9
  });

  const before = resolveOrderDocumentMixedTypography(template, targets);
  assert.equal(before?.fontFamily.mixed, false);
  assert.equal(before?.fontWeight.mixed, true);
  assert.equal(before?.fontSizePt.mixed, true);

  template = applyOrderDocumentTypographyToTargets(template, targets, {
    fontWeight: 'semibold'
  });
  const after = resolveOrderDocumentMixedTypography(template, targets);
  assert.equal(after?.fontWeight.mixed, false);
  assert.equal(after?.fontWeight.value, 'semibold');
  assert.equal(after?.fontSizePt.mixed, true, 'unmodified mixed fields stay independent');
});

test('batch text alignment distinguishes semantic auto from explicit overrides and resets sparsely', () => {
  const targets = [
    { kind: 'field_row', group: 'totals', rowId: 'tax' } as const,
    { kind: 'table_header_cell', columnId: 'lineTotal' } as const
  ];
  let template = cloneDefaultOrderDocumentTemplate('order_summary');

  const automatic = resolveOrderDocumentMixedTextAlignment(template, targets);
  assert.equal(automatic?.overrideState, 'automatic');
  assert.equal(automatic?.mixed, true, 'semantic automatic values can resolve differently');
  assert.equal(resolveOrderDocumentTextAlignment(template, targets[0]), 'distributed');
  assert.equal(resolveOrderDocumentTextAlignment(template, targets[1]), 'right');

  template = applyOrderDocumentTextAlignmentToTargets(template, targets, 'center');
  const centered = resolveOrderDocumentMixedTextAlignment(template, targets);
  assert.deepEqual(centered, {
    value: 'center',
    mixed: false,
    overrideState: 'explicit'
  });
  for (const target of targets) {
    assert.equal(getOrderDocumentTextAlignmentOverride(template, target), 'center');
  }

  template = applyOrderDocumentTextAlignmentToTargets(template, targets, 'justify');
  const justified = resolveOrderDocumentMixedTextAlignment(template, targets);
  assert.deepEqual(justified, {
    value: 'justify',
    mixed: false,
    overrideState: 'explicit'
  });
  for (const target of targets) {
    assert.equal(getOrderDocumentTextAlignmentOverride(template, target), 'justify');
  }

  template = resetOrderDocumentTextAlignmentTargets(template, targets);
  for (const target of targets) {
    assert.equal(getOrderDocumentTextAlignmentOverride(template, target), undefined);
  }
  assert.equal(resolveOrderDocumentTextAlignment(template, targets[0]), 'distributed');
});

test('batch text alignment reports mixed override state even when effective values match', () => {
  const targets = [
    { kind: 'element', elementId: 'intro' } as const,
    { kind: 'field_row', group: 'notes', rowId: 'notes_content' } as const
  ];
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  assert.equal(resolveOrderDocumentTextAlignment(template, targets[0]), 'left');
  assert.equal(resolveOrderDocumentTextAlignment(template, targets[1]), 'left');

  template = setOrderDocumentTextAlignment(template, targets[0], 'left');
  assert.deepEqual(resolveOrderDocumentMixedTextAlignment(template, targets), {
    value: 'left',
    mixed: false,
    overrideState: 'mixed'
  });
});
