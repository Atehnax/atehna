import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { PDFPage } from 'pdf-lib';
import {
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  cloneDefaultOrderDocumentTemplate,
  resolveOrderDocumentFieldRows,
  setOrderDocumentFieldRows,
  type OrderDocumentFieldRowId,
  type OrderDocumentTemplateType
} from '../../src/shared/domain/order/orderDocumentTemplates';
import {
  createOrderDocumentPreviewContext,
  formatOrderDocumentCurrency,
  formatOrderDocumentDate,
  matchesOrderDocumentElementCondition,
  resolveOrderDocumentCustomerRows,
  resolveOrderDocumentFooterRows,
  resolveOrderDocumentItemCells,
  resolveOrderDocumentMetadataRows,
  resolveOrderDocumentTotalRows,
  shouldRenderOrderDocumentPreviewElement
} from '../../src/shared/domain/order/orderDocumentPreview';
import { generateOrderPdf } from '../../src/shared/server/pdf';

const EXPECTED_DOCUMENT_NUMBERS: Record<OrderDocumentTemplateType, string> = {
  order_summary: 'N-7K3M-4X9P-2D6R-8H4Q',
  offer: 'PON-2026-000123-V1',
  dobavnica: '98/26',
  predracun: '96/26',
  invoice: '063/26'
};

const EXPECTED_ITEMS = [
  ['MAT-KOV-ALU-100', '1', 'kos', 'Aluminijasta plošča - 100 × 100 × 0,5 mm', 4.9, 4.9],
  ['MAT-KOV-ALU-200', '2', 'kos', 'Aluminijasta plošča - 200 × 200 × 0,5 mm', 8.9, 17.8],
  ['MAT-KOV-ALU-300', '1', 'kos', 'Aluminijasta plošča - 300 × 200 × 1 mm', 13.5, 13.5],
  ['MAT-KOV-BAK-100', '3', 'kos', 'Bakrena plošča - 100 × 100 × 0,5 mm', 6.4, 19.2],
  ['MAT-LET-JEK-300', '1', 'kos', 'Jeklena merilna letvica - 300 mm', 9.9, 9.9]
] as const;

const EXPECTED_SKUS = EXPECTED_ITEMS.map(([sku]) => sku);

const EXPECTED_METADATA: Record<
  OrderDocumentTemplateType,
  ReadonlyArray<readonly [OrderDocumentFieldRowId, string, string]>
> = {
  order_summary: [
    ['issue_date', 'Datum', '25. 08. 2026'],
    ['order_date', 'Datum naročila', '17. 08. 2026'],
    ['customer_type', 'Vrsta naročnika', 'Šola / javni zavod'],
    ['status', 'Status', 'Potrjeno naročilo'],
    ['reference', 'Referenca naročnika', 'NAR-2026-0186']
  ],
  offer: [
    ['issue_date', 'Datum izdaje', '25. 08. 2026'],
    ['public_code', 'Koda ponudbe', 'PN-7K3M-4X9P-2D6R-8H4Q-V1'],
    ['due_date', 'Ponudba velja do', '09. 09. 2026'],
    ['reference', 'Referenca naročnika', 'NAR-2026-0186']
  ],
  dobavnica: [
    ['issue_date', 'Datum', '25. 08. 2026'],
    ['dispatch_date', 'Datum odpreme', '25. 08. 2026'],
    ['dispatch_method', 'Način odpreme', 'Po dogovoru'],
    ['purchase_order_number', 'Številka naročilnice', 'NAR-2026-0186'],
    ['purchase_order_date', 'Datum naročilnice', '17. 08. 2026']
  ],
  predracun: [
    ['issue_date', 'Datum', '25. 08. 2026'],
    ['public_code', 'Koda naročila', 'N-7K3M-4X9P-2D6R-8H4Q'],
    ['due_date', 'Velja do', '09. 09. 2026'],
    ['reference', 'Referenca naročnika', 'NAR-2026-0186']
  ],
  invoice: [
    ['issue_date', 'Datum', '25. 08. 2026'],
    ['public_code', 'Koda naročila', 'N-7K3M-4X9P-2D6R-8H4Q'],
    ['order_date', 'Datum naročila', '17. 08. 2026'],
    ['purchase_order_number', 'Številka naročilnice', 'NAR-2026-0186'],
    ['purchase_order_date', 'Datum naročilnice', '17. 08. 2026'],
    ['dispatch_date', 'Datum odpreme', '25. 08. 2026'],
    ['due_date', 'Plačilo zapade', '24. 09. 2026'],
    ['payment_reference', 'Sklicna številka', 'NAR-2026-0186']
  ]
};

const EXPECTED_TOTALS: Record<
  OrderDocumentTemplateType,
  ReadonlyArray<readonly [OrderDocumentFieldRowId, string, number, boolean]>
> = {
  order_summary: [
    ['subtotal', 'Skupaj brez DDV', 65.3, false],
    ['tax', 'Davek 22 %', 14.37, false],
    ['total', 'VREDNOST NAROČILA EUR', 79.67, true]
  ],
  offer: [
    ['subtotal', 'Neto vrednost', 65.3, false],
    ['tax', 'DDV 22 %', 14.37, false],
    ['total', 'SKUPAJ PONUDBA EUR', 79.67, true]
  ],
  dobavnica: [
    ['subtotal', 'Skupaj', 65.3, false],
    ['tax', 'Davek 22 %', 14.37, false]
  ],
  predracun: [
    ['subtotal', 'Skupaj', 65.3, false],
    ['tax', 'Davek 22 %', 14.37, false],
    ['total', 'ZA PLAČILO EUR', 79.67, true]
  ],
  invoice: [
    ['subtotal', 'Osnova za DDV', 65.3, false],
    ['tax', 'Davek 22 %', 14.37, false],
    ['total', 'ZA PLAČILO EUR', 79.67, true]
  ]
};

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('all five preview types share one canonical, independently cloned sample context', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const context = createOrderDocumentPreviewContext(type);
    assert.equal(context.type, type);
    assert.equal(context.documentNumber, EXPECTED_DOCUMENT_NUMBERS[type]);
    assert.equal(formatOrderDocumentDate(context.issuedAt), '25. 08. 2026');
    assert.equal(formatOrderDocumentDate(context.order.createdAt), '17. 08. 2026');
    assert.equal(context.order.subtotal, 65.3);
    assert.equal(context.order.shipping, 0);
    assert.equal(context.order.tax, 14.37);
    assert.equal(context.order.total, 79.67);
    assert.equal(context.items.length, 5);
    assert.deepEqual(context.items.map((item) => item.sku), EXPECTED_SKUS);
    assert.equal(
      Number(context.items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0).toFixed(2)),
      context.order.subtotal
    );
  }

  const first = createOrderDocumentPreviewContext('order_summary');
  first.items[0]!.name = 'mutated';
  first.order.reference = 'mutated';
  const fresh = createOrderDocumentPreviewContext('order_summary');
  assert.equal(fresh.items[0]!.name, EXPECTED_ITEMS[0][3]);
  assert.equal(fresh.order.reference, 'NAR-2026-0186');
});

test('canonical editor SKUs are exact catalog variant codes, never numeric article numbers', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const context = createOrderDocumentPreviewContext(type);
    const skus = context.items.map((item) => item.sku);
    assert.deepEqual(skus, EXPECTED_SKUS, `${type} canonical SKU order`);
    assert.equal(new Set(skus).size, skus.length, `${type} SKUs must be unique`);
    for (const sku of skus) {
      assert.ok(sku.trim().length > 0, `${type} SKU must not be empty`);
      assert.doesNotMatch(sku, /^\d+$/u, `${type} must not use numeric-only article number ${sku}`);
    }
    assert.deepEqual(
      context.items.map((item) => resolveOrderDocumentItemCells(item).sku),
      EXPECTED_SKUS,
      `${type} interactive editor SKU cells`
    );
  }
});

test('canonical table rows expose the exact PDF cell values in stable order', () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  assert.deepEqual(
    context.items.map((item) => {
      const cells = resolveOrderDocumentItemCells(item);
      return [
        cells.sku,
        cells.quantity,
        cells.unit,
        cells.description,
        cells.unitPrice,
        cells.lineTotal
      ];
    }),
    EXPECTED_ITEMS.map(([sku, quantity, unit, description, unitPrice, lineTotal]) => [
      sku,
      quantity,
      unit,
      description,
      formatOrderDocumentCurrency(unitPrice),
      formatOrderDocumentCurrency(lineTotal)
    ])
  );
});

test('customer, metadata, totals, and footer semantics match the exact preview for every type', () => {
  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = cloneDefaultOrderDocumentTemplate(type);
    const context = createOrderDocumentPreviewContext(type);

    assert.deepEqual(
      resolveOrderDocumentCustomerRows(template, context).map(({ id, label, value }) => [
        id,
        label,
        value
      ]),
      [
        ['customer', 'Stranka', 'OSNOVNA ŠOLA F. S. FINŽGARJA LESCE'],
        ['contact', 'Kontakt', 'Ana Novak'],
        ['address', 'Naslov', 'Begunjska cesta 7, 4248 Lesce'],
        ['email', 'E-pošta', 'narocila@os-lesce.si']
      ],
      `${type} customer rows`
    );
    assert.deepEqual(
      resolveOrderDocumentMetadataRows(template, context).map(({ id, label, value }) => [
        id,
        label,
        value
      ]),
      EXPECTED_METADATA[type],
      `${type} metadata rows`
    );
    assert.deepEqual(
      resolveOrderDocumentTotalRows(template, context).map(({ id, label, value, bold }) => [
        id,
        label,
        value,
        Boolean(bold)
      ]),
      EXPECTED_TOTALS[type],
      `${type} total rows`
    );
    assert.equal(
      resolveOrderDocumentTotalRows(template, context).some((row) => row.id === 'shipping'),
      false,
      `${type} must omit the canonical zero shipping row`
    );

    const footer = resolveOrderDocumentFooterRows(template, context);
    assert.deepEqual(footer.map((row) => row.id), ['registration_text', 'footer_text']);
    assert.equal(footer.some((row) => /\{[^}]+\}/u.test(row.value)), false);
  }
});

test('semantic resolvers honor persisted row presence and order before filtering empty values', () => {
  const context = createOrderDocumentPreviewContext('invoice');
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  const metadata = resolveOrderDocumentFieldRows(template, 'document_meta');
  const row = (id: OrderDocumentFieldRowId) => {
    const found = metadata.find((candidate) => candidate.id === id);
    assert.ok(found, `Missing metadata row ${id}`);
    return found;
  };
  template = setOrderDocumentFieldRows(template, 'document_meta', [
    row('payment_reference'),
    row('delivery_note'),
    row('order_date')
  ]);
  assert.deepEqual(
    resolveOrderDocumentMetadataRows(template, context).map(({ id }) => id),
    ['payment_reference', 'order_date'],
    'empty delivery-note text must not reappear merely because its row is configured'
  );

  const totals = resolveOrderDocumentFieldRows(template, 'totals');
  const totalRow = (id: OrderDocumentFieldRowId) => {
    const found = totals.find((candidate) => candidate.id === id);
    assert.ok(found, `Missing total row ${id}`);
    return found;
  };
  template = setOrderDocumentFieldRows(template, 'totals', [
    totalRow('total'),
    totalRow('shipping'),
    { ...totalRow('tax'), visible: false },
    totalRow('subtotal')
  ]);
  assert.deepEqual(
    resolveOrderDocumentTotalRows(template, context).map(({ id, value }) => [id, value]),
    [
      ['total', 79.67],
      ['shipping', 0],
      ['subtotal', 65.3]
    ]
  );
});

test('canonical footer page numbering preserves the Slovenian document wording', () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  const template = cloneDefaultOrderDocumentTemplate('order_summary');
  template.layout.showPageNumbers = true;
  const pageNumber = resolveOrderDocumentFooterRows(template, context, 1, 3)
    .find((row) => row.id === 'page_numbers');
  assert.deepEqual(pageNumber, {
    id: 'page_numbers',
    value: 'Stran 2 / 3',
    alignment: 'right'
  });
});

test('canvas conditions use the same canonical facts and page visibility rules as PDF', () => {
  const context = createOrderDocumentPreviewContext('order_summary');
  const canonicalExpectations = {
    always: true,
    has_items: true,
    has_notes: true,
    has_shipping: false,
    has_tax: true,
    has_reference: true
  } as const;
  for (const [condition, expected] of Object.entries(canonicalExpectations)) {
    assert.equal(
      matchesOrderDocumentElementCondition(
        { condition: condition as keyof typeof canonicalExpectations },
        context
      ),
      expected,
      condition
    );
  }

  assert.equal(
    matchesOrderDocumentElementCondition(
      { condition: 'has_items' },
      { ...context, items: [] }
    ),
    false
  );
  assert.equal(
    matchesOrderDocumentElementCondition(
      { condition: 'has_notes' },
      { ...context, order: { ...context.order, notes: '   ' } }
    ),
    false
  );
  assert.equal(
    matchesOrderDocumentElementCondition(
      { condition: 'has_shipping' },
      { ...context, order: { ...context.order, shipping: 6.5 } }
    ),
    true
  );
  assert.equal(
    matchesOrderDocumentElementCondition(
      { condition: 'has_tax' },
      { ...context, order: { ...context.order, tax: 0 } }
    ),
    false
  );
  assert.equal(
    matchesOrderDocumentElementCondition(
      { condition: 'has_reference' },
      { ...context, order: { ...context.order, reference: '' } }
    ),
    false
  );

  const once = { visible: true, condition: 'always', repeat: 'once', page: 1 } as const;
  assert.equal(shouldRenderOrderDocumentPreviewElement(once, context, 1), true);
  assert.equal(shouldRenderOrderDocumentPreviewElement(once, context, 2), false);
  assert.equal(
    shouldRenderOrderDocumentPreviewElement({ ...once, repeat: 'every_page' }, context, 2),
    true
  );
  assert.equal(
    shouldRenderOrderDocumentPreviewElement({ ...once, visible: false }, context, 1),
    false
  );
  assert.equal(
    shouldRenderOrderDocumentPreviewElement(
      { ...once, condition: 'has_shipping' },
      context,
      1
    ),
    false
  );
});

test('interactive canvas, exact PDF route, and renderer consume the shared preview model', () => {
  const canvasSource = source(
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  );
  const routeSource = source(
    'src/admin/api/order-document-templates/preview/route.ts'
  );
  const qaScriptSource = source('scripts/generate-order-document-previews.ts');
  const rendererSource = source('src/shared/server/pdf.ts');

  for (const marker of [
    'createOrderDocumentPreviewContext',
    'resolveOrderDocumentCustomerRows',
    'resolveOrderDocumentMetadataRows',
    'resolveOrderDocumentTotalRows',
    'resolveOrderDocumentItemCells',
    'resolveOrderDocumentFooterRows',
    'shouldRenderOrderDocumentPreviewElement'
  ]) {
    assert.ok(
      (canvasSource.match(new RegExp(`\\b${marker}\\b`, 'gu')) ?? []).length >= 2,
      `Canvas does not consume ${marker} beyond importing it`
    );
  }
  assert.match(routeSource, /createOrderDocumentPreviewContext\s*\(/u);
  assert.doesNotMatch(routeSource, /const PREVIEW_(?:ITEMS|ORDER|CODE)/u);
  assert.match(qaScriptSource, /createOrderDocumentPreviewContext\s*\(/u);
  assert.doesNotMatch(
    qaScriptSource,
    /const (?:previewItems|previewOrder|documentNumbers)\b/u
  );
  for (const marker of [
    'resolveOrderDocumentCustomerRows',
    'resolveOrderDocumentMetadataRows',
    'resolveOrderDocumentTotalRows',
    'resolveOrderDocumentItemCells',
    'resolveOrderDocumentFooterRows',
    'matchesOrderDocumentElementCondition'
  ]) {
    assert.ok(
      (rendererSource.match(new RegExp(`\\b${marker}\\b`, 'gu')) ?? []).length >= 2,
      `PDF renderer does not consume ${marker} beyond importing it`
    );
  }
  for (const staleCanvasSample of [
    'MAT-KOV-AL',
    '313,90 €',
    '390,89 €',
    '26-1500178',
    '60/26'
  ]) {
    assert.equal(
      canvasSource.includes(staleCanvasSample),
      false,
      `Canvas still contains stale sample value: ${staleCanvasSample}`
    );
  }
});

test('exact PDF output contains the shared item and totals values for every template type', async () => {
  const originalDrawText = PDFPage.prototype.drawText;
  const observed = new Map<OrderDocumentTemplateType, string[]>();
  let activeType: OrderDocumentTemplateType | null = null;
  PDFPage.prototype.drawText = function drawText(text, options = {}) {
    if (activeType) observed.get(activeType)?.push(text);
    return originalDrawText.call(this, text, options);
  };

  try {
    for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
      const context = createOrderDocumentPreviewContext(type);
      observed.set(type, []);
      activeType = type;
      await generateOrderPdf({
        ...context,
        template: cloneDefaultOrderDocumentTemplate(type),
        logoArtwork: null
      });
    }
  } finally {
    activeType = null;
    PDFPage.prototype.drawText = originalDrawText;
  }

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const rendered = observed.get(type) ?? [];
    let previousSkuIndex = -1;
    for (const [sku] of EXPECTED_ITEMS) {
      const index = rendered.indexOf(sku);
      assert.ok(index > previousSkuIndex, `${type} did not render SKU ${sku} in order`);
      previousSkuIndex = index;
    }
    for (const [, label, value] of EXPECTED_TOTALS[type]) {
      assert.ok(rendered.includes(label), `${type} did not render total label ${label}`);
      assert.ok(
        rendered.includes(formatOrderDocumentCurrency(value)),
        `${type} did not render total value ${value}`
      );
    }
  }
});

test('the PDF mode is named Predogled PDFja everywhere and never Natančen PDF', () => {
  const editorSource = source(
    'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
  );
  assert.match(editorSource, /Predogled PDFja/u);
  assert.doesNotMatch(editorSource, /Natančen PDF|Natančen predogled PDF/u);
});
