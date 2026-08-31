import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG,
  ORDER_DOCUMENT_CANVAS_ELEMENT_IDS,
  ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT,
  ORDER_DOCUMENT_SECTION_IDS,
  ORDER_DOCUMENT_TABLE_COLUMN_IDS,
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  cloneDefaultOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplatesConfig,
  createOrderDocumentCompanyContactId,
  materializeOrderDocumentCanvasElement,
  materializeOrderDocumentTable,
  normalizeOrderDocumentTemplate,
  normalizeOrderDocumentTemplatesConfig,
  resolveOrderDocumentCanvas,
  resolveOrderDocumentCanvasElement,
  resolveOrderDocumentCompanyContacts,
  resolveOrderDocumentTable,
  resolveOrderDocumentTemplateText,
  setOrderDocumentCompanyContacts,
  validateOrderDocumentTemplatesInput
} from '../../src/shared/domain/order/orderDocumentTemplates';

test('defaults expose five distinct generated PDF templates with colorful headers and Slovene titles', () => {
  assert.deepEqual(ORDER_DOCUMENT_TEMPLATE_TYPES, [
    'order_summary',
    'offer',
    'dobavnica',
    'predracun',
    'invoice'
  ]);
  assert.deepEqual(
    Object.keys(DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates),
    [...ORDER_DOCUMENT_TEMPLATE_TYPES]
  );
  assert.equal(
    Object.hasOwn(DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates, 'purchase_order'),
    false
  );

  const expectedTitles = {
    order_summary: ['Potrditev naročila', 'POTRDITEV NAROČILA'],
    offer: ['Ponudba', 'PONUDBA'],
    dobavnica: ['Dobavnica', 'DOBAVNICA'],
    predracun: ['Predračun', 'PREDRAČUN'],
    invoice: ['Račun', 'RAČUN']
  } as const;

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates[type];

    assert.deepEqual([template.name, template.text.title], expectedTitles[type]);
    assert.equal(template.layout.showHeader, true);
    assert.equal(template.layout.showLogoMark, true);
    assert.equal(template.style.marginMm, 10);
    assert.equal(template.style.logoWidthMm, 73);
    assert.equal(template.style.headerHeightMm, 22);
    assert.equal(template.text.labels.code, 'SKU');
    for (const [key, label] of Object.entries(template.text.labels)) {
      const firstLetter = label.match(/\p{L}/u)?.[0];
      assert.ok(firstLetter, `${type}.${key} must contain a label`);
      assert.equal(
        firstLetter,
        firstLetter.toLocaleUpperCase('sl-SI'),
        `${type}.${key} must start with a capital letter`
      );
    }
  }
});

test('Ponudba rejects removal of essential identity, validity, totals, and acceptance content', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  config.templates.offer.layout.sections = config.templates.offer.layout.sections.map((section) =>
    section.id === 'totals' ? { ...section, enabled: false } : section
  );
  config.templates.offer.layout.fieldRows = {
    document_meta: [{ id: 'issue_date', visible: true }]
  };
  config.templates.offer.text.closing = '';
  config.templates.offer.rules.validityDays = 0;

  const errors = validateOrderDocumentTemplatesInput(config);
  assert.ok(errors.some((message) => message.includes('totals')));
  assert.ok(errors.some((message) => message.includes('due_date')));
  assert.ok(errors.some((message) => message.includes('veljavnosti')));
  assert.ok(errors.some((message) => message.includes('načinu sprejema')));
});

test('default template cloning isolates every nested mutable value', () => {
  const firstConfig = cloneDefaultOrderDocumentTemplatesConfig();
  const secondConfig = cloneDefaultOrderDocumentTemplatesConfig();

  firstConfig.templates.invoice.style.accentColor = '#123456';
  firstConfig.templates.invoice.text.labels.total = 'spremenjeno';
  firstConfig.templates.invoice.layout.columns.sku = false;
  firstConfig.templates.invoice.layout.sections[0].enabled = false;

  assert.equal(secondConfig.templates.invoice.style.accentColor, '#D6A900');
  assert.equal(secondConfig.templates.invoice.text.labels.total, 'ZA PLAČILO EUR');
  assert.equal(secondConfig.templates.invoice.layout.columns.sku, true);
  assert.equal(secondConfig.templates.invoice.layout.sections[0].enabled, true);
  assert.equal(
    DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates.invoice.style.accentColor,
    '#D6A900'
  );

  const firstTemplate = cloneDefaultOrderDocumentTemplate('predracun');
  const secondTemplate = cloneDefaultOrderDocumentTemplate('predracun');
  firstTemplate.company.name = 'Drugo podjetje';
  firstTemplate.layout.sections.reverse();

  assert.equal(secondTemplate.company.name, 'ATEHNA d.o.o., izobraževanje, proizvodnja in storitve');
  assert.deepEqual(
    secondTemplate.layout.sections.map((section) => section.id),
    [...ORDER_DOCUMENT_SECTION_IDS]
  );
});

test('normalization sanitizes colors, clamps measurements, and deduplicates sections', () => {
  const template = normalizeOrderDocumentTemplate('predracun', {
    type: 'purchase_order',
    name: '  Predračun po meri  ',
    style: {
      pageBackground: ' #aabbcc ',
      accentColor: 'blue',
      marginMm: -50,
      headerHeightMm: 90,
      logoWidthMm: 71.24,
      titleSizePt: 18.26,
      lineWidthPt: 0.38,
      titleAlignment: 'center'
    },
    text: {
      title: '  TESTNI PREDRAČUN  ',
      labels: {
        customer: '  naročnik  '
      }
    },
    layout: {
      showHeader: false,
      showFooter: 'false',
      columns: {
        sku: false,
        quantity: 'false'
      },
      sections: [
        { id: 'items', enabled: false },
        { id: 'items', enabled: true },
        { id: 'unknown', enabled: true },
        { id: 'intro', enabled: true }
      ]
    },
    rules: {
      dueDays: -7,
      validityDays: 900
    }
  });

  assert.equal(template.type, 'predracun');
  assert.equal(template.name, 'Predračun po meri');
  assert.equal(template.text.title, 'TESTNI PREDRAČUN');
  assert.equal(template.text.labels.customer, 'naročnik');
  assert.equal(template.text.labels.address, 'Naslov');

  assert.equal(template.style.pageBackground, '#AABBCC');
  assert.equal(template.style.accentColor, '#D6A900');
  assert.equal(template.style.marginMm, 10);
  assert.equal(template.style.headerHeightMm, 48);
  assert.equal(template.style.logoWidthMm, 71);
  assert.equal(template.style.titleSizePt, 18.5);
  assert.equal(template.style.lineWidthPt, 0.5);
  assert.equal(template.style.titleAlignment, 'left');

  assert.equal(template.layout.showHeader, false);
  assert.equal(template.layout.showFooter, true);
  assert.equal(template.layout.columns.sku, false);
  assert.equal(template.layout.columns.quantity, true);
  assert.deepEqual(
    template.layout.sections.map((section) => [section.id, section.enabled]),
    [
      ['items', false],
      ['intro', true],
      ['document_details', true],
      ['totals', true],
      ['notes', true],
      ['closing', true],
      ['signatures', false]
    ]
  );
  assert.equal(new Set(template.layout.sections.map((section) => section.id)).size, 7);
  assert.deepEqual(template.rules, { dueDays: 0, validityDays: 365 });
});

test('normalization upgrades legacy lowercase default labels and Šifra without replacing custom text', () => {
  const template = normalizeOrderDocumentTemplate('dobavnica', {
    text: {
      labels: {
        customer: 'naročnik po meri',
        documentNumber: 'številka dobavnice',
        issueDate: 'datum',
        dispatchDate: 'datum odpreme',
        dispatchMethod: 'način odpreme',
        code: 'šifra',
        quantity: 'količina',
        unit: 'enota',
        description: 'naziv',
        unitPrice: 'cena/enoto',
        lineTotal: 'skupna cena',
        subtotal: 'skupaj',
        tax: 'davek',
        notes: 'opombe',
        handedOverBy: 'predal',
        receivedBy: 'prevzel'
      }
    }
  });

  assert.equal(template.text.labels.customer, 'naročnik po meri');
  assert.deepEqual(
    {
      documentNumber: template.text.labels.documentNumber,
      issueDate: template.text.labels.issueDate,
      dispatchDate: template.text.labels.dispatchDate,
      dispatchMethod: template.text.labels.dispatchMethod,
      code: template.text.labels.code,
      quantity: template.text.labels.quantity,
      unit: template.text.labels.unit,
      description: template.text.labels.description,
      unitPrice: template.text.labels.unitPrice,
      lineTotal: template.text.labels.lineTotal,
      subtotal: template.text.labels.subtotal,
      tax: template.text.labels.tax,
      notes: template.text.labels.notes,
      handedOverBy: template.text.labels.handedOverBy,
      receivedBy: template.text.labels.receivedBy
    },
    {
      documentNumber: 'Številka dobavnice',
      issueDate: 'Datum',
      dispatchDate: 'Datum odpreme',
      dispatchMethod: 'Način odpreme',
      code: 'SKU',
      quantity: 'Količina',
      unit: 'Enota',
      description: 'Naziv',
      unitPrice: 'Cena/enoto',
      lineTotal: 'Skupna cena',
      subtotal: 'Skupaj',
      tax: 'Davek',
      notes: 'Opombe',
      handedOverBy: 'Predal',
      receivedBy: 'Prevzel'
    }
  );
});

test('config normalization ignores purchase orders and restores every generated template', () => {
  const normalized = normalizeOrderDocumentTemplatesConfig({
    templates: {
      order_summary: { name: '  Potrditev po meri  ' },
      purchase_order: { name: 'Ne sme postati predloga' }
    },
    updated_at: '2026-08-25T08:00:00.000Z'
  });

  assert.deepEqual(Object.keys(normalized.templates), [...ORDER_DOCUMENT_TEMPLATE_TYPES]);
  assert.equal(Object.hasOwn(normalized.templates, 'purchase_order'), false);
  assert.equal(normalized.templates.order_summary.name, 'Potrditev po meri');
  assert.equal(normalized.templates.invoice.name, 'Račun');
  assert.equal(normalized.updatedAt, '2026-08-25T08:00:00.000Z');
});

test('template text replacement uses company, rules, and explicit runtime tokens', () => {
  const template = cloneDefaultOrderDocumentTemplate('predracun');
  const resolved = resolveOrderDocumentTemplateText(
    'TRR {iban}; rok {validityDays}; sklic {reference}; nič {zero}; neznano {missing}; prazno {empty}.',
    template,
    {
      iban: 'SI00 TEST',
      validityDays: 30,
      reference: '00-2026-0042',
      zero: 0,
      empty: null
    }
  );

  assert.equal(
    resolved,
    'TRR SI00 TEST; rok 30; sklic 00-2026-0042; nič 0; neznano {missing}; prazno {empty}.'
  );
});

test('validation reports malformed input, missing templates, groups, and section order', () => {
  assert.deepEqual(validateOrderDocumentTemplatesInput(null), [
    'Nastavitve predlog PDF niso veljavne.'
  ]);
  assert.deepEqual(validateOrderDocumentTemplatesInput({}), [
    'Predloga order_summary manjka.',
    'Predloga offer manjka.',
    'Predloga dobavnica manjka.',
    'Predloga predracun manjka.',
    'Predloga invoice manjka.'
  ]);
  assert.deepEqual(
    validateOrderDocumentTemplatesInput(cloneDefaultOrderDocumentTemplatesConfig()),
    []
  );

  const malformed = cloneDefaultOrderDocumentTemplatesConfig() as unknown as {
    templates: Record<string, Record<string, unknown>>;
  };
  delete malformed.templates.order_summary;
  delete malformed.templates.dobavnica.style;
  malformed.templates.invoice.layout = { sections: null };

  const errors = validateOrderDocumentTemplatesInput(malformed);
  assert.ok(errors.includes('Predloga order_summary manjka.'));
  assert.ok(errors.includes('Skupina dobavnica.style manjka.'));
  assert.ok(errors.includes('Vrstni red elementov za invoice manjka.'));
});

test('canvas resolution materializes canonical elements and gates children through their parent groups', () => {
  let template = cloneDefaultOrderDocumentTemplate('invoice');
  const resolved = resolveOrderDocumentCanvas(template);

  assert.deepEqual(Object.keys(resolved.elements), [...ORDER_DOCUMENT_CANVAS_ELEMENT_IDS]);
  assert.equal(resolved.elements.logo.positioning, 'flow');
  assert.equal(resolved.elements.logo.visible, true);
  assert.equal(template.layout.canvas, undefined);

  template = materializeOrderDocumentCanvasElement(template, 'header');
  template = materializeOrderDocumentCanvasElement(template, 'logo');
  assert.deepEqual(Object.keys(template.layout.canvas!.elements).sort(), ['header', 'logo']);
  template.layout.canvas!.elements.header!.visible = false;
  template.layout.canvas!.elements.logo!.visible = true;
  assert.equal(resolveOrderDocumentCanvasElement(template, 'logo').visible, false);

  template.layout.canvas!.elements.header!.visible = true;
  template.layout.showLogoMark = false;
  assert.equal(resolveOrderDocumentCanvasElement(template, 'logo').visible, false);

  template = materializeOrderDocumentCanvasElement(template, 'document_details');
  template = materializeOrderDocumentCanvasElement(template, 'title');
  template.layout.canvas!.elements.document_details!.visible = false;
  template.layout.canvas!.elements.title!.visible = true;
  assert.equal(resolveOrderDocumentCanvasElement(template, 'title').visible, false);
});

test('table resolution preserves canonical product fields while normalizing order, widths, and row sizing', () => {
  let template = materializeOrderDocumentTable(
    cloneDefaultOrderDocumentTemplate('invoice')
  );
  const table = resolveOrderDocumentTable(template);
  const byId = new Map(table.columns.map((column) => [column.id, column]));

  table.columns = [
    { ...byId.get('description')!, visible: false, widthRatio: 41.24 },
    { ...byId.get('lineTotal')!, widthRatio: 20 },
    { ...byId.get('sku')!, visible: true, widthRatio: 18.26 },
    { ...byId.get('quantity')!, visible: false, widthRatio: 7 },
    { ...byId.get('unit')!, visible: true, widthRatio: 6 },
    { ...byId.get('unitPrice')!, visible: true, widthRatio: 8 }
  ];
  table.headerHeightPt = 25.24;
  table.rowHeightPt = 22.26;
  table.rowGapPt = 3.26;
  table.rowHeightOverrides = [
    { rowNumber: 2, heightPt: 33.26 },
    { rowNumber: 2, heightPt: 80 },
    { rowNumber: 1, heightPt: 19.74 }
  ];
  template.layout.table = table;

  const normalized = normalizeOrderDocumentTemplate('invoice', template);
  const resolved = resolveOrderDocumentTable(normalized);
  assert.deepEqual(
    resolved.columns.map((column) => column.id),
    ['description', 'lineTotal', 'sku', 'quantity', 'unit', 'unitPrice']
  );
  assert.deepEqual(
    resolved.columns.map((column) => column.widthRatio),
    [41.2, 20, 18.3, 7, 6, 8]
  );
  assert.deepEqual(
    resolved.rowHeightOverrides,
    [
      { rowNumber: 1, heightPt: 19.5 },
      { rowNumber: 2, heightPt: 33.5 }
    ]
  );
  assert.equal(resolved.headerHeightPt, 25);
  assert.equal(resolved.rowHeightPt, 22.5);
  assert.equal(resolved.rowGapPt, 3.5);
  assert.deepEqual(normalized.layout.columns, {
    sku: true,
    quantity: false,
    unit: true,
    unitPrice: true,
    lineTotal: true
  });

  resolved.columns.find((column) => column.id === 'sku')!.visible = false;
  resolved.columns.find((column) => column.id === 'description')!.visible = false;
  template.layout.table = resolved;
  const protectedTable = resolveOrderDocumentTable(
    normalizeOrderDocumentTemplate('invoice', template)
  );
  assert.equal(
    protectedTable.columns.find((column) => column.id === 'description')!.visible,
    true,
    'at least one identifying product column must remain visible'
  );
  assert.deepEqual(
    new Set(protectedTable.columns.map((column) => column.id)),
    new Set(ORDER_DOCUMENT_TABLE_COLUMN_IDS)
  );
});

test('validation rejects unsafe canvas geometry and malformed product-table structure', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  let invoice = materializeOrderDocumentCanvasElement(config.templates.invoice, 'logo');
  invoice = materializeOrderDocumentCanvasElement(invoice, 'items');
  invoice = materializeOrderDocumentTable(invoice);
  const unsafe = invoice as unknown as {
    layout: {
      canvas: { elements: Record<string, Record<string, unknown>> };
      table: {
        columns: Array<Record<string, unknown>>;
        rowHeightOverrides: Array<Record<string, unknown>>;
      };
    };
  };

  Object.assign(unsafe.layout.canvas.elements.logo, {
    id: 'company',
    xMm: 207,
    widthMm: 10,
    textColor: 'red'
  });
  unsafe.layout.canvas.elements.items.repeat = 'every_page';
  unsafe.layout.table.columns[0].id = 'description';
  unsafe.layout.table.rowHeightOverrides = [{ rowNumber: 1.5, heightPt: 4 }];
  config.templates.invoice = invoice;

  const errors = validateOrderDocumentTemplatesInput(config);
  assert.ok(errors.some((error) => error.includes('ID elementa platna invoice.logo')));
  assert.ok(errors.some((error) => error.includes('sega izven strani A4')));
  assert.ok(errors.some((error) => error.includes('Barva invoice.logo.textColor')));
  assert.ok(errors.some((error) => error.includes('invoice.items se ne sme ponavljati')));
  assert.ok(errors.some((error) => error.includes('invoice.description je podvojen')));
  assert.ok(errors.some((error) => error.includes('invoice.sku manjka')));
  assert.ok(errors.some((error) => error.includes('Številka prilagojene vrstice')));
});

test('company contacts migrate legacy fields once and preserve explicit order, deletion, and emphasis', () => {
  const migrated = normalizeOrderDocumentTemplate('invoice', {
    company: {
      phone: '+386 1 111 11 11',
      fax: '',
      mobile: '+386 40 222 222',
      email: 'racuni@example.test',
      website: 'example.test'
    }
  });
  assert.deepEqual(
    resolveOrderDocumentCompanyContacts(migrated).map((contact) => [
      contact.id,
      contact.label,
      contact.value,
      contact.visible,
      contact.emphasis
    ]),
    [
      ['phone', 'Tel.', '+386 1 111 11 11', true, false],
      ['fax', 'Fax', '', true, false],
      ['mobile', 'GSM', '+386 40 222 222', true, false],
      ['email', 'E-pošta', 'racuni@example.test', true, false],
      ['website', '', 'example.test', true, true]
    ]
  );

  const explicit = setOrderDocumentCompanyContacts(migrated, [
    {
      id: 'support',
      label: 'Podpora',
      value: 'podpora@example.test',
      visible: true,
      emphasis: false
    },
    {
      id: 'website',
      label: '',
      value: 'nova.example.test',
      visible: true,
      emphasis: true
    },
    {
      id: 'phone',
      label: 'Telefon',
      value: '+386 1 333 33 33',
      visible: false,
      emphasis: false
    }
  ]);
  const normalized = normalizeOrderDocumentTemplate('invoice', explicit);
  assert.deepEqual(
    normalized.company.contacts.map((contact) => contact.id),
    ['support', 'website', 'phone']
  );
  assert.equal(normalized.company.contacts.some((contact) => contact.id === 'fax'), false);
  assert.equal(normalized.company.fax, '');
  assert.equal(normalized.company.phone, '');
  assert.equal(normalized.company.website, 'nova.example.test');
  assert.equal(normalized.company.contacts[1].emphasis, true);
  assert.equal(
    createOrderDocumentCompanyContactId(normalized.company.contacts, 'support'),
    'support-2'
  );
});

test('company contact validation rejects oversized, duplicate, and malformed explicit lists', () => {
  const config = cloneDefaultOrderDocumentTemplatesConfig();
  const unsafe = config.templates.invoice.company as unknown as {
    contacts: Array<Record<string, unknown>>;
  };
  unsafe.contacts = Array.from(
    { length: ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT + 1 },
    (_, index) => ({
      id: index < 2 ? 'duplicate' : index === 2 ? 'Invalid ID' : 'contact-' + index,
      label: index === 3 ? 'x'.repeat(81) : 'Kontakt',
      value: index === 4 ? 'x'.repeat(301) : 'vrednost',
      visible: index === 5 ? 'yes' : true,
      emphasis: index === 6 ? null : false
    })
  );

  const errors = validateOrderDocumentTemplatesInput(config);
  assert.ok(errors.some((error) => error.includes('največ 20 vnosov')));
  assert.ok(errors.some((error) => error.includes('duplicate je podvojen')));
  assert.ok(errors.some((error) => error.includes('ID kontaktnega podatka')));
  assert.ok(errors.some((error) => error.includes('Oznaka kontaktnega podatka')));
  assert.ok(errors.some((error) => error.includes('Vrednost kontaktnega podatka')));
  assert.ok(errors.some((error) => error.includes('Vidnost kontaktnega podatka')));
  assert.ok(errors.some((error) => error.includes('Poudarek kontaktnega podatka')));
});
