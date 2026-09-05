import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ORDER_DOCUMENT_FIELD_GROUP_IDS,
  ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP,
  cloneDefaultOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplatesConfig,
  materializeOrderDocumentCanvasElement,
  normalizeOrderDocumentTemplate,
  normalizeOrderDocumentTemplatesConfig,
  removeOrderDocumentFieldRow,
  resolveOrderDocumentFieldRows,
  restoreOrderDocumentFieldRow,
  setOrderDocumentFieldRows,
  validateOrderDocumentTemplatesInput
} from '../../src/shared/domain/order/orderDocumentTemplates';

const canvasSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ),
  'utf8'
);
const rendererSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/pdf.ts'),
  'utf8'
);
const previewModelSource = readFileSync(
  resolve(process.cwd(), 'src/shared/domain/order/orderDocumentPreview.ts'),
  'utf8'
);

const SHARED_PREVIEW_ROW_RESOLVERS: Partial<
  Record<keyof typeof EXPECTED_ROWS, string>
> = {
  customer: 'resolveOrderDocumentCustomerRows',
  document_meta: 'resolveOrderDocumentMetadataRows',
  totals: 'resolveOrderDocumentTotalRows',
  footer: 'resolveOrderDocumentFooterRows'
};

const EXPECTED_ROWS = {
  title: ['title_text', 'document_number', 'subtitle'],
  company: ['company_name', 'address_line_1', 'address_line_2', 'contacts'],
  customer: ['customer', 'contact', 'address', 'email'],
  document_meta: [
    'document_number',
    'public_code',
    'issue_date',
    'order_date',
    'customer_type',
    'status',
    'reference',
    'dispatch_date',
    'dispatch_method',
    'purchase_order_number',
    'purchase_order_date',
    'delivery_note',
    'due_date',
    'payment_reference'
  ],
  totals: ['subtotal', 'shipping', 'tax', 'total'],
  notes: ['notes_label', 'notes_content'],
  closing: ['payment_terms', 'closing_text', 'signer_name'],
  signatures: ['handed_over_by', 'received_by'],
  footer: ['registration_text', 'footer_text', 'page_numbers']
} as const;

test('field-row model covers every multi-row PDF element with stable semantic identities', () => {
  assert.deepEqual(
    [...ORDER_DOCUMENT_FIELD_GROUP_IDS].sort(),
    Object.keys(EXPECTED_ROWS).sort()
  );
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    assert.deepEqual(
      ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group],
      EXPECTED_ROWS[group],
      `${group} must expose every independently editable presentation row`
    );
  }
});

test('document metadata rows can be reordered, deleted, normalized, and restored', () => {
  let template = cloneDefaultOrderDocumentTemplate('dobavnica');
  const defaults = resolveOrderDocumentFieldRows(template, 'document_meta');
  const dispatchDate = defaults.find((row) => row.id === 'dispatch_date');
  const dispatchMethod = defaults.find((row) => row.id === 'dispatch_method');
  assert.ok(dispatchDate, 'Dobavnica must expose Datum odpreme as a semantic row');
  assert.ok(dispatchMethod, 'Dobavnica must expose Način odpreme as a semantic row');

  template = setOrderDocumentFieldRows(template, 'document_meta', [
    dispatchMethod,
    dispatchDate,
    ...defaults.filter(
      (row) => row.id !== 'dispatch_method' && row.id !== 'dispatch_date'
    )
  ]);
  assert.deepEqual(
    resolveOrderDocumentFieldRows(template, 'document_meta')
      .slice(0, 2)
      .map((row) => row.id),
    ['dispatch_method', 'dispatch_date']
  );

  template = removeOrderDocumentFieldRow(
    template,
    'document_meta',
    'dispatch_method'
  );
  const normalized = normalizeOrderDocumentTemplate(
    'dobavnica',
    JSON.parse(JSON.stringify(template))
  );
  assert.equal(
    resolveOrderDocumentFieldRows(normalized, 'document_meta')
      .some((row) => row.id === 'dispatch_method'),
    false,
    'normalization must not recreate a deliberately removed row'
  );

  const restored = restoreOrderDocumentFieldRow(
    normalized,
    'document_meta',
    'dispatch_method'
  );
  assert.equal(
    resolveOrderDocumentFieldRows(restored, 'document_meta')
      .some((row) => row.id === 'dispatch_method'),
    true
  );
});

test('saved PDF layouts are authoritative regardless of stored version', () => {
  for (const schemaVersion of [undefined, 1, 2]) {
    const config = cloneDefaultOrderDocumentTemplatesConfig();
    for (const type of ['offer', 'predracun', 'invoice'] as const) {
      config.templates[type] = removeOrderDocumentFieldRow(
        config.templates[type], 'document_meta', 'public_code'
      );
    }
    const normalized = normalizeOrderDocumentTemplatesConfig({
      ...config, schemaVersion
    });
    assert.equal(normalized.schemaVersion, 2);
    for (const type of ['offer', 'predracun', 'invoice'] as const) {
      assert.equal(
        resolveOrderDocumentFieldRows(normalized.templates[type], 'document_meta')
          .some((row) => row.id === 'public_code'),
        false,
        `Normalizing ${type} must not migrate a saved version ${schemaVersion} layout`
      );
    }
  }
});

test('PDF defaults include public codes without overriding saved hidden rows', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  for (const type of ['offer', 'predracun', 'invoice'] as const) {
    const defaults = resolveOrderDocumentFieldRows(config.templates[type], 'document_meta');
    assert.equal(defaults.find((row) => row.id === 'public_code')?.visible, true);
    config.templates[type] = setOrderDocumentFieldRows(
      config.templates[type],
      'document_meta',
      defaults.map((row) => row.id === 'public_code' ? { ...row, visible: false } : row)
    );
  }
  const normalized = normalizeOrderDocumentTemplatesConfig(config);
  for (const type of ['offer', 'predracun', 'invoice'] as const) {
    assert.equal(
      resolveOrderDocumentFieldRows(normalized.templates[type], 'document_meta')
        .find((row) => row.id === 'public_code')?.visible,
      false
    );
  }
});

test('Datum is the first natural order-data row and never a title row for all document types', () => {
  for (const type of ['order_summary', 'dobavnica', 'predracun', 'invoice'] as const) {
    const template = cloneDefaultOrderDocumentTemplate(type);
    assert.equal(resolveOrderDocumentFieldRows(template, 'document_meta')[0]?.id, 'issue_date');
    assert.equal(
      resolveOrderDocumentFieldRows(template, 'title').some((row) => row.id === 'issue_date'),
      false,
      `${type} must keep Datum out of the title group`
    );
  }
});

test('editing current title rows preserves default metadata and Datum for every document type', () => {
  for (const type of ['order_summary', 'offer', 'dobavnica', 'predracun', 'invoice'] as const) {
    const original = cloneDefaultOrderDocumentTemplate(type);
    const expectedMetadata = resolveOrderDocumentFieldRows(original, 'document_meta');
    const edited = setOrderDocumentFieldRows(
      original,
      'title',
      resolveOrderDocumentFieldRows(original, 'title').map((row) => ({
        ...row,
        typography: { fontSizePt: 15 }
      }))
    );
    const normalized = normalizeOrderDocumentTemplate(type, JSON.parse(JSON.stringify(edited)));
    assert.deepEqual(resolveOrderDocumentFieldRows(normalized, 'document_meta'), expectedMetadata);
    assert.equal(normalized.layout.fieldRows?.document_meta, undefined, 'title edits must not materialize metadata');
    assert.equal(resolveOrderDocumentFieldRows(normalized, 'document_meta')[0]?.id, 'issue_date');
    assert.deepEqual(normalizeOrderDocumentTemplate(type, normalized), normalized);
  }
});

test('metadata Datum deletion stays deleted without materializing or depending on title rows', () => {
  for (const titleIsEdited of [false, true]) {
    let template = cloneDefaultOrderDocumentTemplate('invoice');
    if (titleIsEdited) {
      template = setOrderDocumentFieldRows(template, 'title', [{ id: 'title_text', visible: true }]);
    }
    const previousTitle = template.layout.fieldRows?.title;
    template = removeOrderDocumentFieldRow(template, 'document_meta', 'issue_date');
    assert.deepEqual(template.layout.fieldRows?.title, previousTitle);
    const normalized = normalizeOrderDocumentTemplate('invoice', JSON.parse(JSON.stringify(template)));
    assert.equal(resolveOrderDocumentFieldRows(normalized, 'document_meta').some((row) => row.id === 'issue_date'), false);
    assert.deepEqual(normalized.layout.fieldRows?.title, previousTitle);
    const restored = restoreOrderDocumentFieldRow(normalized, 'document_meta', 'issue_date');
    assert.equal(resolveOrderDocumentFieldRows(restored, 'document_meta').filter((row) => row.id === 'issue_date').length, 1);
  }
});

test('current metadata placement and styling stay within their explicit owner on round-trip', () => {
  for (const positioning of ['flow', 'absolute'] as const) {
    let template = cloneDefaultOrderDocumentTemplate('invoice');
    template = materializeOrderDocumentCanvasElement(template, 'title');
    template = materializeOrderDocumentCanvasElement(template, 'document_meta');
    Object.assign(template.layout.canvas!.elements.title!, { positioning, xMm: 30, yMm: 50, widthMm: 100, heightMm: 20 });
    Object.assign(template.layout.canvas!.elements.document_meta!, { positioning, xMm: 100, yMm: 65, widthMm: 90, heightMm: 30 });
    template = setOrderDocumentFieldRows(template, 'document_meta', [{
      id: 'issue_date',
      visible: false,
      typography: { fontFamily: 'barlow', fontWeight: 'bold', fontStyle: 'italic', fontSizePt: 11 },
      decoration: { outlineEnabled: false, outlineColor: '#D6A900', paddingPt: 5 },
      placement: { xMm: 2, yMm: 3, widthMm: 30, heightMm: 6 }
    }]);
    const normalized = normalizeOrderDocumentTemplate('invoice', JSON.parse(JSON.stringify(template)));
    assert.deepEqual(normalized.layout.fieldRows, template.layout.fieldRows);
    assert.deepEqual(normalized.layout.canvas, template.layout.canvas);
    assert.deepEqual(normalizeOrderDocumentTemplate('invoice', normalized), normalized);
  }
});

test('unsupported title Datum is rejected and never converted into current metadata', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const input = config as unknown as { templates: { invoice: { layout: Record<string, unknown> } } };
  input.templates.invoice.layout.fieldRows = {
    title: [{ id: 'issue_date', visible: true, typography: { fontSizePt: 8 } }],
    document_meta: [{ id: 'issue_date', visible: true, typography: { fontSizePt: 11 }, placement: { xMm: 2, yMm: 3 } }]
  };
  assert.ok(validateOrderDocumentTemplatesInput(input).some((error) => error.includes('invoice.title.issue_date')));
  const normalized = normalizeOrderDocumentTemplate('invoice', input.templates.invoice);
  assert.deepEqual(normalized.layout.fieldRows?.title, []);
  assert.deepEqual(normalized.layout.fieldRows?.document_meta, [{
    id: 'issue_date', visible: true, typography: { fontSizePt: 11 }, placement: { xMm: 2, yMm: 3 }
  }]);
});

test('default totals rows preserve each document type’s established presentation order', () => {
  const expected = {
    order_summary: ['subtotal', 'shipping', 'tax', 'total'],
    dobavnica: ['subtotal', 'tax'],
    predracun: ['subtotal', 'shipping', 'tax', 'total'],
    invoice: ['shipping', 'subtotal', 'tax', 'total']
  } as const;

  for (const [type, rowIds] of Object.entries(expected)) {
    assert.deepEqual(
      resolveOrderDocumentFieldRows(
        cloneDefaultOrderDocumentTemplate(type as keyof typeof expected),
        'totals'
      ).map((row) => row.id),
      rowIds
    );
  }
});

test('every field-row group allows complete presentation omission without losing the setting', () => {
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    const template = setOrderDocumentFieldRows(
      cloneDefaultOrderDocumentTemplate('invoice'),
      group,
      []
    );
    const normalized = normalizeOrderDocumentTemplate(
      'invoice',
      JSON.parse(JSON.stringify(template))
    );
    assert.deepEqual(
      resolveOrderDocumentFieldRows(normalized, group),
      [],
      `${group} must preserve an explicit empty presentation-row list`
    );
  }
});

test('PDF renderer resolves the canonical presentation rows in every multi-row branch', () => {
  assert.match(rendererSource, /resolveOrderDocumentFieldRows/u);
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    const sharedResolver =
      SHARED_PREVIEW_ROW_RESOLVERS[group as keyof typeof EXPECTED_ROWS];
    assert.ok(
      rendererSource.includes(`fieldRows('${group}')`)
        || rendererSource.includes(`orderSemanticRows('${group}'`)
        || Boolean(sharedResolver && rendererSource.includes(sharedResolver)),
      `PDF renderer must consume ordered/omitted ${group} rows`
    );
    if (sharedResolver) {
      assert.ok(
        previewModelSource.includes(`orderSemanticRows(template, '${group}'`)
          || previewModelSource.includes(`visibleRows(template, '${group}')`),
        `Shared preview resolver must preserve ordered/omitted ${group} rows`
      );
    }
  }
});

test('semantic rows expose contextual move, remove, and restore controls on the canvas', () => {
  assert.match(canvasSource, /resolveOrderDocumentFieldRows/u);
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    const sharedResolver =
      SHARED_PREVIEW_ROW_RESOLVERS[group as keyof typeof EXPECTED_ROWS];
    assert.ok(
      canvasSource.includes(`visibleFieldRows('${group}')`)
        || Boolean(sharedResolver && canvasSource.includes(sharedResolver)),
      `Canvas preview must consume ordered/omitted ${group} rows`
    );
  }
  for (const marker of [
    'data-order-document-semantic-row-id',
    'data-order-document-row-move="up"',
    'data-order-document-row-move="down"'
  ]) {
    assert.ok(canvasSource.includes(marker), `Missing semantic-row editor marker: ${marker}`);
  }
  assert.match(canvasSource, /data-order-document-row-remove=\{selection\.rowId\}/u);
  assert.match(canvasSource, /data-order-document-row-restore=\{rowId\}/u);
});

test('floating child editors use a low-contrast dark field instead of a white cutout', () => {
  const inspectorStart = canvasSource.indexOf('const renderSelectedChildInspector');
  assert.notEqual(inspectorStart, -1, 'Missing selected child inspector');
  const inspectorEnd = canvasSource.indexOf(
    'const renderContentInspector',
    inspectorStart
  );
  assert.notEqual(inspectorEnd, -1, 'Missing selected child inspector boundary');
  const inspector = canvasSource.slice(inspectorStart, inspectorEnd);
  const classStart = canvasSource.indexOf('const childToolbarInputClassName');
  const classEnd = canvasSource.indexOf('const FIELD_ROW_DISPLAY_NAMES', classStart);
  assert.ok(classStart >= 0 && classEnd > classStart, 'Missing floating child input class');
  const inputClass = canvasSource.slice(classStart, classEnd);

  assert.match(inspector, /childToolbarInputClassName/u);
  assert.match(inputClass, /bg-slate-(?:700|800|900)/u);
  assert.match(inputClass, /text-(?:white|slate-100)/u);
  assert.doesNotMatch(inputClass, /\bbg-white\b/u);
});
