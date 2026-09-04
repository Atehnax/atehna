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
  setOrderDocumentFieldRows
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

test('saved PDF templates receive the customer-code row once and later edits stay authoritative', () => {
  const legacy = cloneDefaultOrderDocumentTemplatesConfig() as unknown as {
    schemaVersion?: number;
    templates: ReturnType<typeof cloneDefaultOrderDocumentTemplatesConfig>['templates'];
  };
  delete legacy.schemaVersion;
  legacy.templates.invoice = setOrderDocumentFieldRows(
    legacy.templates.invoice,
    'document_meta',
    resolveOrderDocumentFieldRows(legacy.templates.invoice, 'document_meta')
      .filter((row) => row.id !== 'public_code')
  );

  const migrated = normalizeOrderDocumentTemplatesConfig(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(
    resolveOrderDocumentFieldRows(migrated.templates.invoice, 'document_meta')
      .some((row) => row.id === 'public_code'),
    true
  );

  const edited = {
    ...migrated,
    templates: {
      ...migrated.templates,
      invoice: removeOrderDocumentFieldRow(
        migrated.templates.invoice,
        'document_meta',
        'public_code'
      )
    }
  };
  const normalizedEdit = normalizeOrderDocumentTemplatesConfig(edited);
  assert.equal(
    resolveOrderDocumentFieldRows(
      normalizedEdit.templates.invoice,
      'document_meta'
    ).some((row) => row.id === 'public_code'),
    false
  );
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

test('normalization migrates legacy title Datum once while preserving safe presentation data', () => {
  const legacy = cloneDefaultOrderDocumentTemplate('invoice') as unknown as {
    layout: Record<string, unknown>;
  };
  legacy.layout.fieldRows = {
    title: [
      { id: 'title_text', visible: true },
      {
        id: 'issue_date',
        visible: true,
        typography: { fontFamily: 'barlow', fontWeight: 'semibold', fontSizePt: 9 },
        decoration: { outlineEnabled: true, outlineColor: '#D6A900' },
        placement: { xMm: 70, yMm: 4, widthMm: 35, heightMm: 7 }
      },
      { id: 'subtitle', visible: true }
    ],
    document_meta: [
      { id: 'order_date', visible: true },
      { id: 'due_date', visible: true }
    ]
  };

  const migrated = normalizeOrderDocumentTemplate('invoice', legacy);
  const titleRows = resolveOrderDocumentFieldRows(migrated, 'title');
  const metadataRows = resolveOrderDocumentFieldRows(migrated, 'document_meta');
  assert.equal(titleRows.some((row) => row.id === 'issue_date'), false);
  assert.equal(metadataRows.filter((row) => row.id === 'issue_date').length, 1);
  assert.equal(metadataRows[0]?.id, 'issue_date');
  assert.deepEqual(metadataRows[0]?.typography, {
    fontFamily: 'barlow',
    fontWeight: 'semibold',
    fontSizePt: 9
  });
  assert.deepEqual(metadataRows[0]?.decoration, {
    outlineEnabled: true,
    outlineColor: '#D6A900'
  });
  assert.equal(
    metadataRows[0]?.placement,
    undefined,
    'flow-owned legacy coordinates are unsafe in the metadata owner and must reset'
  );
});

test('legacy title Datum deletion remains deleted and an existing metadata Datum is not duplicated', () => {
  const deleted = cloneDefaultOrderDocumentTemplate('dobavnica') as unknown as {
    layout: Record<string, unknown>;
  };
  deleted.layout.fieldRows = {
    title: [{ id: 'title_text', visible: true }, { id: 'document_number', visible: true }]
  };
  const normalizedDeleted = normalizeOrderDocumentTemplate('dobavnica', deleted);
  assert.equal(
    resolveOrderDocumentFieldRows(normalizedDeleted, 'document_meta')
      .some((row) => row.id === 'issue_date'),
    false
  );

  const duplicate = cloneDefaultOrderDocumentTemplate('predracun') as unknown as {
    layout: Record<string, unknown>;
  };
  duplicate.layout.fieldRows = {
    title: [{ id: 'issue_date', visible: true, typography: { fontSizePt: 8 } }],
    document_meta: [{ id: 'issue_date', visible: true, typography: { fontSizePt: 11 } }]
  };
  const normalizedDuplicate = normalizeOrderDocumentTemplate('predracun', duplicate);
  const dates = resolveOrderDocumentFieldRows(normalizedDuplicate, 'document_meta')
    .filter((row) => row.id === 'issue_date');
  assert.equal(dates.length, 1);
  assert.equal(dates[0]?.typography?.fontSizePt, 11, 'the explicit destination setting wins');
});

test('legacy Datum placement converts only between safe absolute owners', () => {
  let template = cloneDefaultOrderDocumentTemplate('order_summary');
  template = materializeOrderDocumentCanvasElement(template, 'title');
  template = materializeOrderDocumentCanvasElement(template, 'document_meta');
  Object.assign(template.layout.canvas!.elements.title!, {
    positioning: 'absolute',
    xMm: 30,
    yMm: 50,
    widthMm: 100,
    heightMm: 20,
    page: 1
  });
  Object.assign(template.layout.canvas!.elements.document_meta!, {
    positioning: 'absolute',
    xMm: 100,
    yMm: 65,
    widthMm: 90,
    heightMm: 30,
    page: 1
  });
  const legacy = template as unknown as { layout: Record<string, unknown> };
  legacy.layout.fieldRows = {
    title: [{
      id: 'issue_date',
      visible: true,
      placement: { xMm: 80, yMm: 20, widthMm: 30, heightMm: 6 }
    }]
  };

  const migrated = normalizeOrderDocumentTemplate('order_summary', legacy);
  const issueDate = resolveOrderDocumentFieldRows(migrated, 'document_meta')[0];
  assert.equal(issueDate?.id, 'issue_date');
  assert.deepEqual(issueDate?.placement, {
    xMm: 10,
    yMm: 5,
    widthMm: 30,
    heightMm: 6
  });
});

test('mixed legacy Datum rows merge sparse styling while destination geometry stays atomic', () => {
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  template = materializeOrderDocumentCanvasElement(template, 'title');
  template = materializeOrderDocumentCanvasElement(template, 'document_meta');
  Object.assign(template.layout.canvas!.elements.title!, {
    positioning: 'absolute',
    xMm: 30,
    yMm: 50,
    widthMm: 100,
    heightMm: 20,
    page: 1
  });
  Object.assign(template.layout.canvas!.elements.document_meta!, {
    positioning: 'absolute',
    xMm: 100,
    yMm: 65,
    widthMm: 90,
    heightMm: 30,
    page: 1
  });
  const legacy = template as unknown as { layout: Record<string, unknown> };
  legacy.layout.fieldRows = {
    title: [{
      id: 'issue_date',
      visible: true,
      typography: {
        fontFamily: 'barlow',
        fontWeight: 'semibold',
        fontStyle: 'italic'
      },
      decoration: {
        outlineEnabled: true,
        outlineColor: '#D6A900',
        accentEnabled: true,
        accentColor: '#B88B00',
        paddingPt: 2
      },
      placement: { xMm: 80, yMm: 20, widthMm: 30, heightMm: 6 }
    }],
    document_meta: [{
      id: 'issue_date',
      visible: true,
      typography: { fontWeight: 'bold', fontSizePt: 11 },
      decoration: { outlineEnabled: false, paddingPt: 5 },
      placement: { xMm: 2, yMm: 3 }
    }]
  };

  const migrated = normalizeOrderDocumentTemplate('invoice', legacy);
  const issueDate = resolveOrderDocumentFieldRows(migrated, 'document_meta')[0];
  assert.deepEqual(issueDate?.typography, {
    fontFamily: 'barlow',
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSizePt: 11
  });
  assert.deepEqual(issueDate?.decoration, {
    outlineEnabled: false,
    outlineColor: '#D6A900',
    accentEnabled: true,
    accentColor: '#B88B00',
    paddingPt: 5
  });
  assert.deepEqual(
    issueDate?.placement,
    { xMm: 2, yMm: 3 },
    'destination placement must win as one geometry object without source width or height'
  );
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
