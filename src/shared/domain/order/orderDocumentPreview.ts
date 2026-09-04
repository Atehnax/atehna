import {
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTemplateText,
  type OrderDocumentCanvasElement,
  type OrderDocumentFieldGroupId,
  type OrderDocumentFieldRowId,
  type OrderDocumentTableColumnId,
  type OrderDocumentTemplate,
  type OrderDocumentTemplateType
} from './orderDocumentTemplates';

const LOCALE = 'sl-SI';

export type OrderDocumentPreviewItem = {
  sku: string;
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  taxRate?: number | null;
  discountPercentage?: number | null;
  shipLater?: boolean;
};

export type OrderDocumentPreviewItemSection = {
  id: 'all' | 'current' | 'later';
  label: string | null;
  items: OrderDocumentPreviewItem[];
  startRowNumber: number;
};

export const DELIVERY_NOTE_CURRENT_ITEMS_LABEL = 'Postavke v tej dobavi';
export const DELIVERY_NOTE_LATER_ITEMS_LABEL = 'Postavke za poznejšo dobavo';

export type OrderDocumentPreviewOrder = {
  customerType: string;
  organizationName?: string | null;
  contactName: string;
  email: string;
  deliveryAddress?: string | null;
  reference?: string | null;
  publicCode?: string | null;
  notes?: string | null;
  createdAt: Date;
  subtotal: number;
  tax: number;
  taxRate?: number | null;
  shipping?: number;
  shippingOverride?: boolean;
  total: number;
  commitmentStatus?: 'binding' | 'pending_confirmation' | 'rejected' | string | null;
};

export type OrderDocumentPreviewContext = {
  type: OrderDocumentTemplateType;
  order: OrderDocumentPreviewOrder;
  items: OrderDocumentPreviewItem[];
  documentNumber: string;
  issuedAt: Date;
};

export type OrderDocumentSemanticTextRow = {
  id: OrderDocumentFieldRowId;
  label: string;
  value: string;
  bold?: boolean;
};

export type OrderDocumentSemanticTotalRow = {
  id: OrderDocumentFieldRowId;
  label: string;
  value: number;
  bold?: boolean;
};

export type OrderDocumentFooterRow = {
  id: OrderDocumentFieldRowId;
  value: string;
  alignment: 'center' | 'right';
};

export type OrderDocumentPreviewItemCells = Record<
  OrderDocumentTableColumnId,
  string
>;

const PREVIEW_DOCUMENT_NUMBERS: Record<OrderDocumentTemplateType, string> = {
  order_summary: 'N-7K3M-4X9P-2D6R-8H4Q',
  offer: 'PON-2026-000123-V1',
  dobavnica: '98/26',
  predracun: '96/26',
  invoice: '063/26'
};

const PREVIEW_ITEMS: readonly OrderDocumentPreviewItem[] = [
  {
    sku: 'MAT-KOV-ALU-100',
    name: 'Aluminijasta plošča - 100 × 100 × 0,5 mm',
    unit: 'kos',
    quantity: 1,
    unitPrice: 4.9,
    lineTotal: 4.9
  },
  {
    sku: 'MAT-KOV-ALU-200',
    name: 'Aluminijasta plošča - 200 × 200 × 0,5 mm',
    unit: 'kos',
    quantity: 2,
    unitPrice: 8.9,
    lineTotal: 17.8
  },
  {
    sku: 'MAT-KOV-ALU-300',
    name: 'Aluminijasta plošča - 300 × 200 × 1 mm',
    unit: 'kos',
    quantity: 1,
    unitPrice: 13.5,
    lineTotal: 13.5
  },
  {
    sku: 'MAT-KOV-BAK-100',
    name: 'Bakrena plošča - 100 × 100 × 0,5 mm',
    unit: 'kos',
    quantity: 3,
    unitPrice: 6.4,
    lineTotal: 19.2
  },
  {
    sku: 'MAT-LET-JEK-300',
    name: 'Jeklena merilna letvica - 300 mm',
    unit: 'kos',
    quantity: 1,
    unitPrice: 9.9,
    lineTotal: 9.9
  }
];

const ljubljanaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function createOrderDocumentPreviewContext(
  type: OrderDocumentTemplateType
): OrderDocumentPreviewContext {
  return {
    type,
    documentNumber: PREVIEW_DOCUMENT_NUMBERS[type],
    issuedAt: new Date('2026-08-25T10:38:00+02:00'),
    order: {
      customerType: 'school',
      organizationName: 'OSNOVNA ŠOLA F. S. FINŽGARJA LESCE',
      contactName: 'Ana Novak',
      email: 'narocila@os-lesce.si',
      deliveryAddress: 'Begunjska cesta 7, 4248 Lesce',
      reference: 'NAR-2026-0186',
      publicCode:
        type === 'offer'
          ? 'PN-7K3M-4X9P-2D6R-8H4Q-V1'
          : 'N-7K3M-4X9P-2D6R-8H4Q',
      notes: 'Dostava v tajništvo šole med 8.00 in 13.00.',
      createdAt: new Date('2026-08-17T08:30:00+02:00'),
      subtotal: 65.3,
      tax: 14.37,
      taxRate: 0.22,
      shipping: 0,
      total: 79.67,
      commitmentStatus: 'binding'
    },
    items: PREVIEW_ITEMS.map((item, index) => ({
      ...item,
      ...(type === 'dobavnica' && index >= 3 ? { shipLater: true } : {})
    }))
  };
}

export function toSafeOrderDocumentText(value: unknown) {
  return String(value ?? '')
    .replace(/[‐‑‒–—―]/gu, '-')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\t\f\v]+/gu, ' ')
    .replace(/ {2,}/gu, ' ')
    .trim();
}

export function toOrderDocumentNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toLjubljanaDateParts(date: Date) {
  const parts = ljubljanaDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    day: part('day'),
    month: part('month'),
    year: part('year')
  };
}

export function formatOrderDocumentDate(date: Date) {
  const { day, month, year } = toLjubljanaDateParts(date);
  return `${day}. ${month}. ${year}`;
}

export function addOrderDocumentDays(date: Date, days: number) {
  const { day, month, year } = toLjubljanaDateParts(date);
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) + days, 12, 0, 0)
  );
}

export function formatOrderDocumentCurrency(value: number) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function resolveOrderDocumentCustomerTypeLabel(value: string) {
  if (value === 'school') return 'Šola / javni zavod';
  if (value === 'company') return 'Podjetje';
  if (value === 'individual') return 'Fizična oseba';
  return toSafeOrderDocumentText(value);
}

export function resolveOrderDocumentCommitmentLabel(
  value: OrderDocumentPreviewOrder['commitmentStatus']
) {
  if (value === 'pending_confirmation') {
    return 'Čaka na naročilnico oziroma potrditev';
  }
  if (value === 'binding') return 'Potrjeno naročilo';
  if (value === 'rejected') return 'Naročilo zavrnjeno';
  return value ? toSafeOrderDocumentText(value) : '';
}

function visibleRows(template: OrderDocumentTemplate, group: OrderDocumentFieldGroupId) {
  return resolveOrderDocumentFieldRows(template, group).filter((row) => row.visible);
}

function orderSemanticRows<Row extends { id: OrderDocumentFieldRowId }>(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  candidates: readonly Row[]
) {
  const byId = new Map<OrderDocumentFieldRowId, Row[]>();
  for (const candidate of candidates) {
    byId.set(candidate.id, [...(byId.get(candidate.id) ?? []), candidate]);
  }
  return visibleRows(template, group).flatMap((row) => byId.get(row.id) ?? []);
}

function contextReplacements(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
) {
  return {
    documentNumber: context.documentNumber,
    issueDate: formatOrderDocumentDate(context.issuedAt),
    orderDate: formatOrderDocumentDate(context.order.createdAt),
    dueDate: formatOrderDocumentDate(
      addOrderDocumentDays(context.issuedAt, template.rules.dueDays)
    ),
    reference: context.order.reference || context.documentNumber
  };
}

export function resolveOrderDocumentPreviewText(
  value: string,
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
) {
  return resolveOrderDocumentTemplateText(
    value,
    template,
    contextReplacements(template, context)
  );
}

export function resolveOrderDocumentCustomerRows(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
): OrderDocumentSemanticTextRow[] {
  const customer = context.order.organizationName || context.order.contactName;
  const separateContact = context.order.organizationName
    && context.order.contactName !== context.order.organizationName
    ? context.order.contactName
    : '';
  return orderSemanticRows(template, 'customer', [
    { id: 'customer', label: template.text.labels.customer, value: customer, bold: true },
    { id: 'contact', label: template.text.labels.contact, value: separateContact },
    {
      id: 'address',
      label: template.text.labels.address,
      value: context.order.deliveryAddress || ''
    },
    { id: 'email', label: template.text.labels.email, value: context.order.email }
  ]).filter((row) => Boolean(toSafeOrderDocumentText(row.value)));
}

export function resolveOrderDocumentMetadataRows(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
): OrderDocumentSemanticTextRow[] {
  const { order, issuedAt, documentNumber, type } = context;
  const labels = template.text.labels;
  const validityOrDueDays = type === 'predracun' || type === 'offer'
    ? template.rules.validityDays
    : template.rules.dueDays;
  const candidates: OrderDocumentSemanticTextRow[] = [
    { id: 'document_number', label: labels.documentNumber, value: documentNumber, bold: true },
    {
      id: 'public_code',
      label: labels.publicCode,
      value: order.publicCode || '',
      bold: true
    },
    { id: 'issue_date', label: labels.issueDate, value: formatOrderDocumentDate(issuedAt) },
    { id: 'order_date', label: labels.orderDate, value: formatOrderDocumentDate(order.createdAt) },
    {
      id: 'customer_type',
      label: labels.customerType,
      value: type === 'order_summary'
        ? resolveOrderDocumentCustomerTypeLabel(order.customerType)
        : ''
    },
    {
      id: 'status',
      label: labels.status,
      value: type === 'order_summary'
        ? resolveOrderDocumentCommitmentLabel(order.commitmentStatus)
        : '',
      bold: true
    },
    { id: 'reference', label: labels.reference, value: order.reference || '' },
    {
      id: 'dispatch_date',
      label: labels.dispatchDate,
      value: type === 'dobavnica' || type === 'invoice'
        ? formatOrderDocumentDate(issuedAt)
        : ''
    },
    {
      id: 'dispatch_method',
      label: labels.dispatchMethod,
      value: type === 'dobavnica'
        ? resolveOrderDocumentPreviewText(template.text.deliveryMethod, template, context)
        : ''
    },
    {
      id: 'purchase_order_number',
      label: labels.purchaseOrderNumber,
      value: order.reference || '',
      bold: type === 'dobavnica'
    },
    {
      id: 'purchase_order_date',
      label: labels.purchaseOrderDate,
      value: order.reference ? formatOrderDocumentDate(order.createdAt) : ''
    },
    { id: 'delivery_note', label: labels.deliveryNote, value: '' },
    {
      id: 'due_date',
      label: labels.dueDate,
      value: validityOrDueDays > 0
        ? formatOrderDocumentDate(addOrderDocumentDays(issuedAt, validityOrDueDays))
        : '',
      bold: true
    },
    {
      id: 'payment_reference',
      label: labels.paymentReference,
      value: type === 'invoice' ? order.reference || documentNumber : ''
    }
  ];
  const rows = orderSemanticRows(template, 'document_meta', candidates)
    .filter((row) => Boolean(toSafeOrderDocumentText(row.value)));
  return rows;
}

function inferredTaxRate(context: OrderDocumentPreviewContext) {
  const explicit = toOrderDocumentNumber(context.order.taxRate);
  if (explicit > 0) return explicit > 1 ? explicit / 100 : explicit;
  const subtotal = toOrderDocumentNumber(context.order.subtotal);
  const tax = toOrderDocumentNumber(context.order.tax);
  return subtotal > 0 ? tax / subtotal : 0;
}

function resolveTaxRows(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
) {
  const groups = new Map<number, number>();
  for (const item of context.items) {
    const rawRate = toOrderDocumentNumber(item.taxRate);
    if (rawRate <= 0) continue;
    const rate = rawRate > 1 ? rawRate / 100 : rawRate;
    const net = item.lineTotal == null
      ? toOrderDocumentNumber(item.unitPrice) * Math.max(0, item.quantity)
      : toOrderDocumentNumber(item.lineTotal);
    groups.set(rate, (groups.get(rate) ?? 0) + net * rate);
  }

  const totalTax = toOrderDocumentNumber(context.order.tax);
  if (groups.size <= 1) {
    const rate = groups.keys().next().value ?? inferredTaxRate(context);
    return [{
      label: `${template.text.labels.tax} ${(rate * 100).toLocaleString(LOCALE, {
        maximumFractionDigits: 2
      })} %`,
      value: totalTax
    }];
  }

  const rows = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rate, value]) => ({
      label: `${template.text.labels.tax} ${(rate * 100).toLocaleString(LOCALE, {
        maximumFractionDigits: 2
      })} %`,
      value
    }));
  const residual = totalTax - rows.reduce((sum, row) => sum + row.value, 0);
  if (Math.abs(residual) >= 0.01) {
    rows.push({ label: template.text.labels.tax, value: residual });
  }
  return rows;
}

export function resolveOrderDocumentTotalRows(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext
): OrderDocumentSemanticTotalRow[] {
  const explicit = Boolean(
    template.layout.fieldRows
    && Object.prototype.hasOwnProperty.call(template.layout.fieldRows, 'totals')
  );
  const shippingEnabled = explicit || (
    template.layout.showShipping
    && (
      toOrderDocumentNumber(context.order.shipping) !== 0
      || context.order.shippingOverride === true
    )
  );
  const taxEnabled = explicit || template.layout.showTaxSummary;
  const taxRows = taxEnabled
    ? resolveTaxRows(template, context).map((row): OrderDocumentSemanticTotalRow => ({
        id: 'tax',
        label: row.label,
        value: row.value
      }))
    : [];
  const candidates: OrderDocumentSemanticTotalRow[] = [
    {
      id: 'subtotal',
      label: template.text.labels.subtotal,
      value: toOrderDocumentNumber(context.order.subtotal)
    },
    ...(shippingEnabled
      ? [{
          id: 'shipping' as const,
          label: template.text.labels.shipping,
          value: toOrderDocumentNumber(context.order.shipping)
        }]
      : []),
    ...taxRows,
    {
      id: 'total',
      label: template.text.labels.total,
      value: toOrderDocumentNumber(context.order.total),
      bold: true
    }
  ];
  return orderSemanticRows(template, 'totals', candidates);
}

export function resolveOrderDocumentItemCells(
  item: OrderDocumentPreviewItem
): OrderDocumentPreviewItemCells {
  const discount = toOrderDocumentNumber(item.discountPercentage);
  const description = discount > 0
    ? `${item.name} (-${discount.toLocaleString(LOCALE)} %)`
    : item.name;
  return {
    sku: item.sku || '-',
    quantity: String(item.quantity),
    unit: item.unit || '-',
    description,
    unitPrice: formatOrderDocumentCurrency(toOrderDocumentNumber(item.unitPrice)),
    lineTotal: formatOrderDocumentCurrency(
      item.lineTotal == null
        ? toOrderDocumentNumber(item.unitPrice) * Math.max(0, item.quantity)
        : toOrderDocumentNumber(item.lineTotal)
    )
  };
}

export function resolveOrderDocumentItemSections(
  type: OrderDocumentTemplateType,
  items: readonly OrderDocumentPreviewItem[]
): OrderDocumentPreviewItemSection[] {
  const allItems = [...items];
  if (type !== 'dobavnica' || !allItems.some((item) => item.shipLater === true)) {
    return [{ id: 'all', label: null, items: allItems, startRowNumber: 1 }];
  }

  const currentItems = allItems.filter((item) => item.shipLater !== true);
  const laterItems = allItems.filter((item) => item.shipLater === true);
  return [
    {
      id: 'current',
      label: DELIVERY_NOTE_CURRENT_ITEMS_LABEL,
      items: currentItems,
      startRowNumber: 1
    },
    {
      id: 'later',
      label: DELIVERY_NOTE_LATER_ITEMS_LABEL,
      items: laterItems,
      startRowNumber: currentItems.length + 1
    }
  ];
}

export function resolveOrderDocumentFooterRows(
  template: OrderDocumentTemplate,
  context: OrderDocumentPreviewContext,
  pageIndex = 0,
  pageCount = 1
): OrderDocumentFooterRow[] {
  const explicit = Boolean(
    template.layout.fieldRows
    && Object.prototype.hasOwnProperty.call(template.layout.fieldRows, 'footer')
  );
  return visibleRows(template, 'footer').flatMap((row): OrderDocumentFooterRow[] => {
    const raw = row.id === 'registration_text'
      ? resolveOrderDocumentPreviewText(template.company.registrationText, template, context)
      : row.id === 'footer_text'
        ? resolveOrderDocumentPreviewText(template.text.footerText, template, context)
        : row.id === 'page_numbers' && (explicit || template.layout.showPageNumbers)
          ? `Stran ${pageIndex + 1} / ${pageCount}`
          : '';
    return raw
      ? [{
          id: row.id,
          value: raw,
          alignment: row.id === 'page_numbers' ? 'right' : 'center'
        }]
      : [];
  });
}

export function matchesOrderDocumentElementCondition(
  element: Pick<OrderDocumentCanvasElement, 'condition'>,
  context: OrderDocumentPreviewContext
) {
  if (element.condition === 'has_items') return context.items.length > 0;
  if (element.condition === 'has_notes') {
    return Boolean(toSafeOrderDocumentText(context.order.notes));
  }
  if (element.condition === 'has_shipping') {
    return (
      toOrderDocumentNumber(context.order.shipping) !== 0
      || context.order.shippingOverride === true
    );
  }
  if (element.condition === 'has_tax') {
    return toOrderDocumentNumber(context.order.tax) !== 0;
  }
  if (element.condition === 'has_reference') {
    return Boolean(toSafeOrderDocumentText(context.order.reference));
  }
  return true;
}

export function shouldRenderOrderDocumentPreviewElement(
  element: Pick<
    OrderDocumentCanvasElement,
    'visible' | 'condition' | 'repeat' | 'page'
  >,
  context: OrderDocumentPreviewContext,
  pageNumber = 1
) {
  if (!element.visible || !matchesOrderDocumentElementCondition(element, context)) {
    return false;
  }
  return element.repeat === 'every_page' || element.page === pageNumber;
}
