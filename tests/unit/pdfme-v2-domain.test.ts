import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTemplate } from '@pdfme/common';
import type { Schema, Template } from '@pdfme/common';

import {
  PDFME_V2_ALLOWED_BINDINGS,
  PDFME_V2_DATA_BINDINGS,
  PDFME_V2_DOCUMENT_TYPES,
  PDFME_V2_BOLD_FONT_NAME,
  PDFME_V2_DEFAULT_PADDING_MM,
  PDFME_V2_DEFAULT_TABLE_WIDTH_PERCENTAGES,
  PDFME_V2_DOCUMENT_STYLE,
  PDFME_V2_ENGINE_VERSION,
  PDFME_V2_LONG_NOTES,
  PDFME_V2_SAMPLE_ROW_COUNTS,
  PDFME_V2_SCHEMA_VERSION,
  PdfmeV2ValidationError,
  adaptCheckoutSnapshotToDocumentRenderData,
  adaptDatabaseOrderToDocumentRenderData,
  compilePdfmeV2Template,
  composeProductVariantDisplayName,
  createDefaultPdfmeV2Template,
  createDefaultPdfmeV2Templates,
  createPdfmeV2SampleRenderData,
  reconcilePdfmeV2DesignerTemplate,
  sanitizePdfmeV2Svg,
  toPdfmeV2Input,
  validateDocumentRenderData,
  validateGeneratedPdfBytes,
  validatePdfmeV2CanonicalTemplate,
  type CheckoutSnapshotRenderSource,
  type DatabaseOrderRenderSource,
  type PdfmeV2CanonicalTemplate
} from '../../src/shared/domain/pdfmeV2';

function cloneCanonical(value: PdfmeV2CanonicalTemplate): PdfmeV2CanonicalTemplate {
  return structuredClone(value);
}

function assertValidationCode(code: string, callback: () => unknown) {
  assert.throws(callback, (error: unknown) =>
    error instanceof PdfmeV2ValidationError && error.code === code);
}

test('document types contain exactly the four generated v2 types', () => {
  assert.deepEqual(PDFME_V2_DOCUMENT_TYPES, [
    'order_summary',
    'dobavnica',
    'predracun',
    'invoice'
  ]);
  assert.equal((PDFME_V2_DOCUMENT_TYPES as readonly string[]).includes('purchase_order'), false);
  assert.equal((PDFME_V2_DOCUMENT_TYPES as readonly string[]).includes('offer'), false);
  assert.deepEqual(Object.keys(createDefaultPdfmeV2Templates()), PDFME_V2_DOCUMENT_TYPES);
});

test('each default is a polished one-page A4 seed with stable ATEHNA authoring markers', () => {
  const expectedCopy = {
    order_summary: {
      title: 'POTRDITEV NAROČILA',
      metaLabel: 'Datum naročila:',
      closing: 'O odpremi',
      schemaCount: 19,
      hasIntro: true
    },
    dobavnica: {
      title: 'DOBAVNICA',
      metaLabel: 'Datum odpreme:',
      closing: 'Prevzel:',
      schemaCount: 17,
      hasIntro: false
    },
    predracun: {
      title: 'PREDRAČUN',
      metaLabel: 'Velja do:',
      closing: 'Predračun velja 15 dni.',
      schemaCount: 17,
      hasIntro: false
    },
    invoice: {
      title: 'RAČUN',
      metaLabel: 'Plačilo zapade:',
      closing: 'Prosimo, poravnajte račun',
      schemaCount: 17,
      hasIntro: false
    }
  } as const;

  for (const type of PDFME_V2_DOCUMENT_TYPES) {
    const canonical = createDefaultPdfmeV2Template(type);
    const validated = validatePdfmeV2CanonicalTemplate(canonical);
    checkTemplate(validated.template);

    assert.equal(canonical.template.pdfmeVersion, PDFME_V2_ENGINE_VERSION);
    assert.equal(canonical.envelope.schemaVersion, PDFME_V2_SCHEMA_VERSION);
    assert.equal(canonical.envelope.documentType, type);
    assert.deepEqual(canonical.template.basePdf, {
      width: 210,
      height: 297,
      padding: [...PDFME_V2_DEFAULT_PADDING_MM]
    });
    assert.equal(canonical.template.schemas.length, 1);

    const page = canonical.template.schemas[0];
    assert.equal(page.length, expectedCopy[type].schemaCount);
    assert.equal(page[0]?.name, 'stevilcenjeStrani');
    assert.equal(page[0]?.content, 'Stran {currentPage} / {totalPages}');
    assert.equal(page.some((schema) => schema.type === 'image'), false);

    const ids = page.map((schema) => schema.atehnaId);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach((id) => assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    ));
    ids.forEach((id) => {
      assert.equal(Object.hasOwn(canonical.envelope.labels, id), true);
    });

    Object.keys(canonical.envelope.bindings).forEach((id) => assert.ok(ids.includes(id)));

    const namesFor = (markerIds: readonly string[]) => markerIds.map((id) =>
      page.find((schema) => schema.atehnaId === id)?.name
    );
    assert.deepEqual(namesFor(canonical.envelope.repeating.header), [
      'znamkaAtehna',
      'sloganAtehna',
      'podatkiPodjetja',
      'crtaGlave'
    ]);
    assert.deepEqual(namesFor(canonical.envelope.repeating.footer), [
      'stevilcenjeStrani',
      'registrskiPodatki',
      'bancniPodatki'
    ]);

    const wordmark = page.find((schema) => schema.name === 'znamkaAtehna');
    assert.ok(wordmark);
    assert.equal(wordmark.type, 'text');
    assert.equal(wordmark.content, 'ATEHNA');
    assert.equal(wordmark.fontName, PDFME_V2_BOLD_FONT_NAME);
    assert.equal(wordmark.fontColor, PDFME_V2_DOCUMENT_STYLE.accentColor);

    const documentTitle = page.find((schema) => schema.name === 'naslovDokumenta');
    assert.ok(documentTitle);
    assert.equal(documentTitle.content, expectedCopy[type].title);

    const documentNumber = page.find((schema) => schema.name === 'stevilkaDokumenta');
    assert.ok(documentNumber);
    assert.equal(documentNumber.content, '{documentNumber}');
    assert.deepEqual(documentNumber.position, { x: 150, y: 45 });
    assert.equal(documentNumber.width, 50);
    assert.equal(documentNumber.fontSize, 10.5);

    const metadataLabels = page.find((schema) => schema.name === 'oznakeDokumenta');
    assert.ok(metadataLabels);
    assert.match(String(metadataLabels.content), new RegExp(expectedCopy[type].metaLabel, 'u'));

    const intro = page.find((schema) => schema.name === 'uvod');
    assert.equal(Boolean(intro), expectedCopy[type].hasIntro);
    if (type === 'order_summary') {
      assert.match(intro?.content ?? '', /ni račun/u);
    }

    const closing = page.find((schema) => schema.name === 'zakljucek');
    assert.ok(closing);
    assert.match(String(closing.content), new RegExp(expectedCopy[type].closing, 'u'));

    const table = page.find((schema) => schema.type === 'table');
    assert.ok(table);
    const tableStyles = table as typeof table & {
      headWidthPercentages: number[];
      headStyles: Record<string, unknown>;
      bodyStyles: Record<string, unknown>;
    };
    assert.equal(table.name, 'itemsTable');
    assert.deepEqual(table.position, { x: 10, y: type === 'order_summary' ? 122 : 106 });
    assert.equal(table.width, 190);
    assert.equal(table.showHead, true);
    assert.equal(table.repeatHead, true);
    assert.deepEqual(
      tableStyles.headWidthPercentages,
      [...PDFME_V2_DEFAULT_TABLE_WIDTH_PERCENTAGES]
    );
    assert.equal(tableStyles.headStyles.fontName, PDFME_V2_BOLD_FONT_NAME);
    assert.equal(
      tableStyles.headStyles.backgroundColor,
      PDFME_V2_DOCUMENT_STYLE.tableHeaderBackground
    );
    assert.equal(
      tableStyles.bodyStyles.alternateBackgroundColor,
      PDFME_V2_DOCUMENT_STYLE.tableStripeColor
    );
    assert.equal(table.content, '[]');

    const totals = page.filter((schema) => schema.name === 'sestevki');
    assert.equal(totals.length, 1);
    assert.equal(totals[0].textFormat, 'plain');
    assert.equal(totals[0].borderColor, PDFME_V2_DOCUMENT_STYLE.accentColor);
    assert.match(String(totals[0].content), /\{total\}/u);
  }
});

test('header/footer compilation is pure and preserves exact schema order and values', () => {
  const canonical = createDefaultPdfmeV2Template('invoice');
  const before = structuredClone(canonical);
  const page = canonical.template.schemas[0];
  const markerIds = new Set([
    ...canonical.envelope.repeating.header,
    ...canonical.envelope.repeating.footer
  ]);
  const expectedStatic = page.filter((schema) => markerIds.has(schema.atehnaId));
  const expectedOrdinary = page.filter((schema) => !markerIds.has(schema.atehnaId));

  const compiled = compilePdfmeV2Template(canonical);
  assert.deepEqual(canonical, before, 'compiler must not mutate the persisted value');
  assert.equal(typeof compiled.basePdf, 'object');
  assert.deepEqual(
    (compiled.basePdf as { staticSchema?: Schema[] }).staticSchema,
    expectedStatic
  );
  assert.deepEqual(compiled.schemas[0], expectedOrdinary);
  assert.notEqual(compiled.schemas[0], canonical.template.schemas[0]);

  const firstOrdinaryId = expectedOrdinary[0].atehnaId;
  (compiled.schemas[0][0] as Record<string, unknown>).name = 'changedInClone';
  assert.notEqual(
    canonical.template.schemas[0].find((schema) => schema.atehnaId === firstOrdinaryId)?.name,
    'changedInClone'
  );
});

test('database rows and immutable checkout snapshots compose product plus variant identically', () => {
  const order = {
    order_number: '#42',
    customer_type: 'company',
    organization_name: 'Čista družba d.o.o.',
    contact_name: 'Žan Šubic',
    email: 'zan@example.test',
    address_line1: 'Šolska ulica 4',
    address_line2: null,
    postal_code: '1000',
    city: 'Ljubljana',
    country_code: 'SI',
    reference: 'REF-42',
    notes: 'Brez posebnosti.',
    subtotal: '20.00',
    tax: '4.40',
    shipping: '0',
    total: '24.40',
    currency: 'EUR',
    created_at: '2026-08-25T06:00:00.000Z'
  } as const;
  const databaseSource: DatabaseOrderRenderSource = {
    order,
    items: [{
      line_number: 1,
      sku: 'MIZA-MODRA',
      name: 'Delovna miza – Modra',
      variant_name: 'Modra',
      unit: 'kos',
      quantity: 2,
      unit_net: 10,
      line_net: 20,
      tax_rate: 0.22,
      discount_pct: 0,
      currency: 'EUR'
    }]
  };
  const snapshotSource: CheckoutSnapshotRenderSource = {
    order,
    items: [{
      line_number: 1,
      product_name: 'Delovna miza',
      variant_name: 'Modra',
      sku: 'MIZA-MODRA',
      unit: 'kos',
      quantity: 2,
      unit_net: 10,
      line_net: 20,
      tax_rate: 0.22,
      discount_pct: 0,
      currency: 'EUR',
      snapshot_json: { productName: 'Staro ime se ne sme uporabiti' }
    }]
  };
  const options = {
    documentType: 'invoice' as const,
    documentNumber: 'R-42',
    issuedAt: '2026-08-27T07:00:00.000Z'
  };
  const databaseData = adaptDatabaseOrderToDocumentRenderData(databaseSource, options);
  const snapshotData = adaptCheckoutSnapshotToDocumentRenderData(snapshotSource, options);

  assert.equal(databaseData.items[0].displayName, 'Delovna miza – Modra');
  assert.equal(snapshotData.items[0].displayName, databaseData.items[0].displayName);
  assert.deepEqual(databaseData.items, snapshotData.items);
  assert.equal(
    composeProductVariantDisplayName('Delovna miza – Modra', 'Modra'),
    'Delovna miza – Modra'
  );
  validateDocumentRenderData(databaseData);
  validateDocumentRenderData(snapshotData);
});

test('shared deterministic fixtures cover 0, 1, 27 and 100 rows plus long content boundaries', () => {
  assert.equal(PDFME_V2_LONG_NOTES.length, 4_000);
  for (const rowCount of PDFME_V2_SAMPLE_ROW_COUNTS) {
    const first = createPdfmeV2SampleRenderData('order_summary', rowCount);
    const second = createPdfmeV2SampleRenderData('order_summary', rowCount);
    assert.deepEqual(second, first);
    assert.equal(first.items.length, rowCount);
    if (rowCount === 100) {
      assert.equal(first.notes.length, 4_000);
    } else {
      assert.ok(first.notes.length < 4_000);
      assert.match(first.notes, /č š ž Č Š Ž/u);
    }
    validateDocumentRenderData(first);

    const input = toPdfmeV2Input(first);
    assert.deepEqual(Object.keys(input).sort(), [...PDFME_V2_DATA_BINDINGS].sort());
    assert.equal(Object.hasOwn(input, 'currentPage'), false);
    assert.equal(Object.hasOwn(input, 'totalPages'), false);
    const rows = JSON.parse(input.itemsTable) as string[][];
    assert.equal(rows.length, rowCount);
    assert.equal(new Set(rows.map((row) => row[1])).size, rowCount);
    first.items.forEach((item, index) => {
      assert.equal(rows[index][1], item.displayName, 'item order must be stable');
    });
  }

  const hundred = createPdfmeV2SampleRenderData('invoice', 100);
  assert.ok(hundred.items[0].sku.length > 100);
  assert.ok(hundred.items[0].displayName.length > 100);
  assert.equal(hundred.items[99].quantity, 1_000_000);
  assert.equal(hundred.items[99].unitNet, 500_000);
});

test('render-data limits accept exact boundaries and reject the first item/note beyond them', () => {
  const hundred = createPdfmeV2SampleRenderData('invoice', 100);
  validateDocumentRenderData(hundred);

  const tooMany = structuredClone(hundred) as unknown as {
    items: Array<Record<string, unknown>>;
  };
  tooMany.items.push({ ...tooMany.items[99], lineNumber: 101 });
  assertValidationCode('TOO_MANY_ITEMS', () => validateDocumentRenderData(tooMany));

  const tooLong = structuredClone(hundred) as unknown as { notes: string };
  tooLong.notes += 'x';
  assertValidationCode('STRING_TOO_LONG', () => validateDocumentRenderData(tooLong));
});

test('strict template validation rejects expressions, unsafe transports, types, IDs, geometry and size', () => {
  const expression = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  expression.template.schemas[0][0].content = '{customer.name}';
  assertValidationCode('INVALID_BINDING', () => validatePdfmeV2CanonicalTemplate(expression));

  const unknownType = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  (unknownType.template.schemas[0][0] as Record<string, unknown>).type = 'barcode';
  assertValidationCode('UNKNOWN_SCHEMA_TYPE', () => validatePdfmeV2CanonicalTemplate(unknownType));

  const duplicateId = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  duplicateId.template.schemas[0][1].atehnaId = duplicateId.template.schemas[0][0].atehnaId;
  assertValidationCode('DUPLICATE_ATEHNA_ID', () => validatePdfmeV2CanonicalTemplate(duplicateId));

  const missingId = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  delete (missingId.template.schemas[0][0] as Record<string, unknown>).atehnaId;
  assertValidationCode('EXPECTED_STRING', () => validatePdfmeV2CanonicalTemplate(missingId));

  const geometry = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  geometry.template.schemas[0][0].position.x = Number.NaN;
  assertValidationCode('NON_FINITE_NUMBER', () => validatePdfmeV2CanonicalTemplate(geometry));

  const page = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  page.template.basePdf.width = 211;
  assertValidationCode('INVALID_PAGE_SIZE', () => validatePdfmeV2CanonicalTemplate(page));

  const url = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  url.template.schemas[0][0].content = 'https://example.test/logo.png';
  assertValidationCode('UNSAFE_URL', () => validatePdfmeV2CanonicalTemplate(url));

  const image = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  const originalImageId = image.template.schemas[0][0].atehnaId;
  image.template.schemas[0][0] = {
    atehnaId: originalImageId,
    name: 'headerTitle',
    type: 'image',
    content: 'data:image/png;base64,AAAA',
    position: { x: 15, y: 10 },
    width: 40,
    height: 20,
    rotate: 0,
    opacity: 1,
    readOnly: true
  } as typeof image.template.schemas[0][0];
  assertValidationCode('PERSISTED_ASSET_BYTES', () => validatePdfmeV2CanonicalTemplate(image));

  const tooMany = cloneCanonical(createDefaultPdfmeV2Template('invoice'));
  const source = tooMany.template.schemas[0][2];
  while (tooMany.template.schemas[0].length <= 250) {
    const copy = structuredClone(source);
    copy.name = `copy${tooMany.template.schemas[0].length}`;
    copy.atehnaId = `aaaaaaaa-aaaa-4aaa-8aaa-${String(tooMany.template.schemas[0].length).padStart(12, '0')}`;
    tooMany.template.schemas[0].push(copy);
  }
  assertValidationCode('TOO_MANY_SCHEMAS', () => validatePdfmeV2CanonicalTemplate(tooMany));

  assertValidationCode('PROTOTYPE_PATH', () => validatePdfmeV2CanonicalTemplate(
    '{"template":{},"envelope":{"__proto__":{}}}'
  ));
  assert.deepEqual(PDFME_V2_ALLOWED_BINDINGS.slice(-2), ['currentPage', 'totalPages']);
});

test('SVG sanitizer accepts local fragments and rejects active, external, data and malformed content', () => {
  const safe = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">',
    '<defs><clipPath id="cut"><rect width="10" height="10"/></clipPath></defs>',
    '<g clip-path="url(#cut)"><path d="M0 0 L10 10"/></g>',
    '</svg>'
  ].join('');
  assert.equal(sanitizePdfmeV2Svg(safe), safe);

  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><foreignObject><div>x</div></foreignObject></svg>',
    '<svg><use href="https://example.test/a.svg#x"/></svg>',
    '<svg><use href="data:image/svg+xml;base64,AAAA"/></svg>',
    '<svg><path fill="url(https://example.test/a.svg)"/></svg>',
    '<svg><rect style="fill:&#117;&#114;&#108;(&#104;&#116;&#116;&#112;&#115;&#58;//evil.example/x)"/></svg>',
    '<svg><use href="&#x68;&#x74;&#x74;&#x70;&#x73;&#x3a;//evil.example/x"/></svg>',
    '<svg><text>&#269;</text></svg>',
    '<svg><g></svg>'
  ]) {
    assert.throws(() => sanitizePdfmeV2Svg(unsafe));
  }
});

test('Designer reconciliation preserves identities, repairs copies/additions and prunes metadata', () => {
  const current = createDefaultPdfmeV2Template('invoice');
  const next = structuredClone(current.template) as Template;
  const page = next.schemas[0];
  const removed = page.find((schema) => schema.name === 'narocnik') as Schema & {
    atehnaId: string;
  };
  next.schemas[0] = page.filter((schema) => schema !== removed);

  const notes = next.schemas[0].find((schema) => schema.name === 'opombe') as Schema & {
    atehnaId: string;
    id?: string;
  };
  const notesCopy = structuredClone(notes);
  notesCopy.name = 'opombeKopija';
  notesCopy.id = 'transient-designer-id';
  const originalNotesIndex = next.schemas[0].indexOf(notes);
  next.schemas[0].splice(originalNotesIndex, 0, notesCopy);
  next.schemas[0].push({
    name: 'newRule',
    type: 'line',
    position: { x: 15, y: 235 },
    width: 180,
    height: 0.2,
    rotate: 0,
    opacity: 1,
    readOnly: true,
    color: '#111827',
    id: 'another-transient-id'
  } as Schema);

  const ids = [
    '55555555-5555-4555-8555-555555555501',
    '55555555-5555-4555-8555-555555555502'
  ];
  const reconciled = reconcilePdfmeV2DesignerTemplate(
    current,
    next,
    () => ids.shift() ?? '55555555-5555-4555-8555-555555555599'
  );
  const reconciledPage = reconciled.template.schemas[0];
  const byName = new Map(reconciledPage.map((schema) => [schema.name, schema]));

  assert.equal(byName.get('opombe')?.atehnaId, notes.atehnaId);
  assert.equal(byName.get('opombeKopija')?.atehnaId, '55555555-5555-4555-8555-555555555501');
  assert.equal(byName.get('newRule')?.atehnaId, '55555555-5555-4555-8555-555555555502');
  assert.equal(new Set(reconciledPage.map((schema) => schema.atehnaId)).size, reconciledPage.length);
  assert.equal('id' in (byName.get('opombeKopija') as Record<string, unknown>), false);
  assert.equal('id' in (byName.get('newRule') as Record<string, unknown>), false);
  assert.equal(Object.hasOwn(reconciled.envelope.labels, removed.atehnaId), false);
  assert.equal(reconciled.envelope.labels['55555555-5555-4555-8555-555555555502'], 'Črta');
  assert.deepEqual(
    reconciled.envelope.bindings['55555555-5555-4555-8555-555555555501'],
    ['notes']
  );
  assert.equal(
    reconciled.envelope.visibilityConditions['55555555-5555-4555-8555-555555555501'],
    'hasNotes'
  );
  assert.deepEqual(current, createDefaultPdfmeV2Template('invoice'));
  validatePdfmeV2CanonicalTemplate(reconciled);
});

test('generated byte validation enforces the PDF signature and strict 20 MB ceiling', () => {
  const valid = new TextEncoder().encode('%PDF-1.7\n%%EOF');
  assert.equal(validateGeneratedPdfBytes(valid), valid);
  assertValidationCode('INVALID_PDF_SIGNATURE', () =>
    validateGeneratedPdfBytes(new TextEncoder().encode('not-pdf')));
  assertValidationCode('PDF_TOO_LARGE', () => {
    const oversized = new Uint8Array(20_000_000);
    oversized.set(new TextEncoder().encode('%PDF-'));
    validateGeneratedPdfBytes(oversized);
  });
});
