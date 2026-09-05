import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneDefaultOrderDocumentTemplate,
  getOrderDocumentDecorationOverride,
  materializeOrderDocumentCanvasElement,
  normalizeOrderDocumentTemplate,
  resetOrderDocumentDecoration,
  resetOrderDocumentFieldRowPlacement,
  resolveOrderDocumentCanvasElement,
  resolveOrderDocumentDecoration,
  resolveOrderDocumentFieldRows,
  setOrderDocumentDecoration,
  setOrderDocumentFieldRowPlacement,
  validateOrderDocumentTemplatesInput,
  cloneDefaultOrderDocumentTemplatesConfig
} from '../../src/shared/domain/order/orderDocumentTemplates';

test('semantic decorations resolve professional defaults and explicit false disables them', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  assert.deepEqual(
    resolveOrderDocumentDecoration(template, { kind: 'element', elementId: 'intro' }),
    {
      fillEnabled: false,
      fillColor: '#FFFFFF',
      outlineEnabled: false,
      outlineColor: '#202020',
      outlineWidthPt: 0.5,
      outlineSides: ['left', 'right', 'top', 'bottom'],
      accentEnabled: true,
      accentSide: 'left',
      accentColor: '#D6A900',
      accentWidthPt: 2,
      paddingPt: 10
    }
  );
  const defaultTotal = resolveOrderDocumentDecoration(template, {
      kind: 'field_row',
      group: 'totals',
      rowId: 'total'
    });
  assert.equal(defaultTotal.outlineEnabled, true);
  assert.equal(
    defaultTotal.outlineColor,
    '#D6A900',
    'neutral parent defaults must not replace the semantic final-total accent outline'
  );

  template = setOrderDocumentDecoration(
    template,
    { kind: 'element', elementId: 'totals' },
    { outlineColor: '#334455' }
  );
  assert.equal(
    resolveOrderDocumentDecoration(template, {
      kind: 'field_row',
      group: 'totals',
      rowId: 'total'
    }).outlineColor,
    '#334455',
    'an explicit parent decoration color must remain inheritable'
  );
  template = setOrderDocumentDecoration(
    template,
    { kind: 'field_row', group: 'totals', rowId: 'total' },
    { outlineColor: '#556677' }
  );
  assert.equal(
    resolveOrderDocumentDecoration(template, {
      kind: 'field_row',
      group: 'totals',
      rowId: 'total'
    }).outlineColor,
    '#556677',
    'an explicit row color must win over its parent'
  );

  template = setOrderDocumentDecoration(
    template,
    { kind: 'element', elementId: 'intro' },
    {
      accentEnabled: false,
      fillEnabled: true,
      fillColor: '#FFF5CC',
      outlineEnabled: true,
      outlineColor: '#112233',
      outlineWidthPt: 1.26,
      outlineSides: ['top', 'bottom']
    }
  );
  const resolved = resolveOrderDocumentDecoration(template, {
    kind: 'element',
    elementId: 'intro'
  });
  assert.equal(resolved.accentEnabled, false);
  assert.equal(resolved.fillEnabled, true);
  assert.equal(resolved.fillColor, '#FFF5CC');
  assert.equal(resolved.outlineWidthPt, 1.25);
  assert.deepEqual(resolved.outlineSides, ['top', 'bottom']);

  template = resetOrderDocumentDecoration(template, {
    kind: 'element',
    elementId: 'intro'
  });
  assert.equal(getOrderDocumentDecorationOverride(template, {
    kind: 'element',
    elementId: 'intro'
  }), undefined);
  assert.equal(resolveOrderDocumentDecoration(template, {
    kind: 'element',
    elementId: 'intro'
  }).accentEnabled, true);
});

test('row placement is sparse, owner-relative, normalized, and resettable in every group', () => {
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  const groups = [
    'company',
    'title',
    'customer',
    'document_meta',
    'totals',
    'notes',
    'closing',
    'signatures',
    'footer'
  ] as const;
  for (const group of groups) {
    const rowId = resolveOrderDocumentFieldRows(template, group)[0]!.id;
    template = setOrderDocumentFieldRowPlacement(template, group, rowId, {
      xMm: 12.26,
      yMm: 4.24,
      widthMm: 48.26,
      heightMm: 8.24
    });
  }
  template = normalizeOrderDocumentTemplate(
    'invoice',
    JSON.parse(JSON.stringify(template))
  );
  for (const group of groups) {
    const row = resolveOrderDocumentFieldRows(template, group)[0]!;
    assert.deepEqual(row.placement, {
      xMm: 12.3,
      yMm: 4.2,
      widthMm: 48.3,
      heightMm: 8.2
    });
    template = resetOrderDocumentFieldRowPlacement(template, group, row.id);
    assert.equal(resolveOrderDocumentFieldRows(template, group)[0]!.placement, undefined);
  }
});

test('signed owner-relative row offsets survive setter and storage normalization', () => {
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  template = setOrderDocumentFieldRowPlacement(
    template,
    'document_meta',
    'issue_date',
    { xMm: -18.26, yMm: -7.74, widthMm: 42.25, heightMm: 8.25 }
  );
  template = normalizeOrderDocumentTemplate(
    'invoice',
    JSON.parse(JSON.stringify(template))
  );

  assert.deepEqual(
    resolveOrderDocumentFieldRows(template, 'document_meta')
      .find((row) => row.id === 'issue_date')?.placement,
    { xMm: -18.3, yMm: -7.7, widthMm: 42.3, heightMm: 8.3 }
  );
});

test('current-version manual title and customer geometry is preserved instead of rewritten', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  for (const id of ['title', 'customer', 'document_meta'] as const) {
    template = materializeOrderDocumentCanvasElement(template, id);
  }
  template = normalizeOrderDocumentTemplate('order_summary', template);
  Object.assign(template.layout.canvas!.elements.title!, { yMm: 50, heightMm: 10 });
  Object.assign(template.layout.canvas!.elements.customer!, { yMm: 64, heightMm: 28 });
  Object.assign(template.layout.canvas!.elements.document_meta!, { yMm: 64, heightMm: 28 });

  assert.equal(template.layout.canvas?.flowLayoutVersion, 1);
  const normalized = normalizeOrderDocumentTemplate('order_summary', JSON.parse(JSON.stringify(template)));
  assert.deepEqual(normalized.layout.canvas, template.layout.canvas);
  assert.deepEqual(
    {
      title: [
        resolveOrderDocumentCanvasElement(normalized, 'title').yMm,
        resolveOrderDocumentCanvasElement(normalized, 'title').heightMm
      ],
      customer: [
        resolveOrderDocumentCanvasElement(normalized, 'customer').yMm,
        resolveOrderDocumentCanvasElement(normalized, 'customer').heightMm
      ],
      documentMeta: [
        resolveOrderDocumentCanvasElement(normalized, 'document_meta').yMm,
        resolveOrderDocumentCanvasElement(normalized, 'document_meta').heightMm
      ]
    },
    {
      title: [50, 10],
      customer: [64, 28],
      documentMeta: [64, 28]
    }
  );

  template.layout.canvas!.elements.title!.xMm += 0.5;
  const customized = normalizeOrderDocumentTemplate('order_summary', template);
  assert.equal(resolveOrderDocumentCanvasElement(customized, 'title').heightMm, 10);
  const defaults = cloneDefaultOrderDocumentTemplate('order_summary');
  assert.equal(resolveOrderDocumentCanvasElement(defaults, 'title').heightMm, 15);
  assert.equal(resolveOrderDocumentCanvasElement(defaults, 'customer').yMm, 67);
  assert.equal(resolveOrderDocumentCanvasElement(defaults, 'document_meta').yMm, 67);
});

test('validation rejects malformed placement and decoration data', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const template = config.templates.order_summary;
  template.layout.fieldRows = {
    document_meta: [{
      id: 'issue_date',
      visible: true,
      placement: { xMm: -211 },
      decoration: {
        fillEnabled: true,
        fillColor: 'yellow',
        outlineSides: ['left', 'left'],
        accentWidthPt: 99
      }
    }]
  };
  const errors = validateOrderDocumentTemplatesInput(config);
  assert.ok(errors.some((error) => error.includes('položaja')));
  assert.ok(errors.some((error) => error.includes('fillColor')));
  assert.ok(errors.some((error) => error.includes('Strani obrobe')));
  assert.ok(errors.some((error) => error.includes('accentWidthPt')));
});
