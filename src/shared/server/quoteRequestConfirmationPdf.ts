import 'server-only';

import type { Pool } from 'pg';
import {
  resolveOrderDocumentFieldRows,
  setOrderDocumentFieldRows,
  type OrderDocumentTemplate
} from '@/shared/domain/order/orderDocumentTemplates';
import { generateOrderPdf, type PdfItem, type PdfOrder } from '@/shared/server/pdf';
import {
  formatQuoteCode,
  requireCommercePublicCodeBase
} from '@/shared/domain/commercePublicCode';
import { getOrderDocumentTemplate } from '@/shared/server/orderDocumentTemplates';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { resolveCachedSiteLogoArtwork } from '@/shared/server/siteLogoArtwork';

type QuoteRequestPdfRow = {
  public_code_base?: unknown;
  customer_type?: unknown;
  organization_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  city?: unknown;
  postal_code?: unknown;
  reference?: unknown;
  customer_message?: unknown;
  created_at?: unknown;
  estimate_json?: unknown;
  items?: unknown;
};

type QuoteRequestPdfItemRow = {
  sku?: unknown;
  product_name?: unknown;
  variant_name?: unknown;
  unit?: unknown;
  quantity?: unknown;
  unit_net?: unknown;
  line_net?: unknown;
  tax_rate?: unknown;
  discount_pct?: unknown;
};

type QuoteRequestConfirmationPdf = {
  bytes: Uint8Array;
  filename: string;
};

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function parsedFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNonNegativeNumber(value: unknown, label: string): number {
  const parsed = parsedFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    throw new Error(`Quote request PDF has an invalid ${label}.`);
  }
  return parsed;
}

function optionalNonNegativeNumber(value: unknown, label: string): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return null;
  }
  const parsed = parsedFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    throw new Error(`Quote request PDF has an invalid ${label}.`);
  }
  return parsed;
}

function receiptTemplate(
  source: OrderDocumentTemplate,
  hasCompleteTotals: boolean
): OrderDocumentTemplate {
  const labels = {
    ...source.text.labels,
    documentNumber: 'Koda povpraševanja',
    issueDate: 'Datum izdaje',
    orderDate: 'Datum povpraševanja',
    customer: 'Naročnik',
    email: 'Email',
    address: 'Naslov',
    total: 'OKVIRNA VREDNOST EUR'
  };
  let template: OrderDocumentTemplate = {
    ...source,
    name: 'Potrditev povpraševanja',
    text: {
      ...source.text,
      title: 'POTRDITEV POVPRAŠEVANJA',
      subtitle:
        'Dokument potrjuje prejem povpraševanja in ni ponudba ali naročilo.',
      intro:
        'Povpraševanje smo prejeli. Po pregledu cen, dobavljivosti, dostave in roka dobave vam bomo poslali ponudbo.',
      closing:
        'Količine, cene in dostava so do izdaje ponudbe informativne.',
      signerName: '',
      labels
    },
    layout: {
      ...source.layout,
      sections: source.layout.sections.map((section) =>
        section.id === 'totals'
          ? { ...section, enabled: hasCompleteTotals && section.enabled }
          : section
      )
    }
  };

  const metadataRows = resolveOrderDocumentFieldRows(
    template,
    'document_meta'
  ).filter((row) =>
    row.id === 'order_date' ||
    row.id === 'reference'
  );
  template = setOrderDocumentFieldRows(
    template,
    'document_meta',
    metadataRows
  );

  const customerRows = new Map(
    resolveOrderDocumentFieldRows(template, 'customer').map((row) => [
      row.id,
      row
    ])
  );
  template = setOrderDocumentFieldRows(
    template,
    'customer',
    (['customer', 'email', 'address'] as const).map(
      (id) => customerRows.get(id) ?? { id, visible: true }
    )
  );
  return template;
}

export async function generateQuoteRequestConfirmationPdf(
  database: Pick<Pool, 'query'>,
  quoteRequestId: number
): Promise<QuoteRequestConfirmationPdf | null> {
  const result = await database.query(
    `
      select
        request.public_code_base,
        request.customer_type,
        request.organization_name,
        request.contact_name,
        request.email,
        request.address_line1,
        request.address_line2,
        request.city,
        request.postal_code,
        request.reference,
        request.customer_message,
        request.created_at,
        request.estimate_json,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'sku', item.sku,
              'product_name', item.product_name,
              'variant_name', item.variant_name,
              'unit', item.unit,
              'quantity', item.quantity,
              'unit_net', item.unit_net,
              'line_net', item.line_net,
              'tax_rate', item.tax_rate,
              'discount_pct', item.discount_pct
            )
            order by item.line_number
          ) filter (where item.id is not null),
          '[]'::jsonb
        ) as items
      from quote_requests request
      left join quote_request_items item on item.quote_request_id = request.id
      where request.id = $1
      group by request.id
      limit 1
    `,
    [quoteRequestId]
  );
  const request = result.rows[0] as QuoteRequestPdfRow | undefined;
  const itemRows = Array.isArray(request?.items)
    ? request.items.map((item) => record(item) as QuoteRequestPdfItemRow)
    : [];
  if (!request || itemRows.length === 0) return null;

  const quoteCode = formatQuoteCode(
    requireCommercePublicCodeBase(request.public_code_base)
  );
  const createdAt = new Date(
    request.created_at instanceof Date
      ? request.created_at
      : text(request.created_at)
  );
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('Quote request PDF has an invalid identity.');
  }

  const estimate = record(request.estimate_json);
  const totals = record(estimate.totals);
  const subtotal = requiredNonNegativeNumber(totals.net, 'net total');
  const tax = requiredNonNegativeNumber(totals.tax, 'tax total');
  const shipping = optionalNonNegativeNumber(totals.shipping, 'shipping total');
  const gross = optionalNonNegativeNumber(totals.gross, 'gross total');
  if ((shipping === null) !== (gross === null)) {
    throw new Error('Quote request PDF has incomplete totals.');
  }
  const hasCompleteTotals = shipping !== null && gross !== null;
  if (
    hasCompleteTotals &&
    Math.abs(gross - (subtotal + tax + shipping)) > 0.005
  ) {
    throw new Error('Quote request PDF has inconsistent totals.');
  }
  const postalLine = [text(request.postal_code), text(request.city)]
    .filter(Boolean)
    .join(' ');
  const deliveryAddress = [
    text(request.address_line1),
    text(request.address_line2),
    postalLine
  ]
    .filter(Boolean)
    .join(', ');
  const manualEstimateNote = hasCompleteTotals
    ? null
    : 'Poštnina in končna vrednost bosta določeni v ponudbi.';
  const pdfOrder: PdfOrder = {
    customerType: text(request.customer_type),
    organizationName: text(request.organization_name) || null,
    contactName: text(request.contact_name),
    email: text(request.email),
    deliveryAddress: deliveryAddress || null,
    reference: text(request.reference) || null,
    notes: [text(request.customer_message), manualEstimateNote]
      .filter(Boolean)
      .join('\n'),
    createdAt,
    subtotal,
    tax,
    ...(shipping === null ? {} : { shipping }),
    shippingOverride: hasCompleteTotals,
    total: gross ?? subtotal + tax
  };
  const pdfItems: PdfItem[] = itemRows.map((item) => ({
    sku: text(item.sku),
    name: [text(item.product_name), text(item.variant_name)]
      .filter(Boolean)
      .join(' – '),
    unit: text(item.unit) || null,
    quantity: requiredNonNegativeNumber(item.quantity, 'item quantity'),
    unitPrice: requiredNonNegativeNumber(item.unit_net, 'item unit price'),
    lineTotal: requiredNonNegativeNumber(item.line_net, 'item line total'),
    taxRate: optionalNonNegativeNumber(item.tax_rate, 'item tax rate'),
    discountPercentage: optionalNonNegativeNumber(
      item.discount_pct,
      'item discount percentage'
    )
  }));

  const [sourceTemplate, logoConfig] = await Promise.all([
    getOrderDocumentTemplate('order_summary'),
    getSiteLogoConfig()
  ]);
  const logoArtwork = await resolveCachedSiteLogoArtwork(
    logoConfig,
    'pdf-document'
  );
  const bytes = await generateOrderPdf({
    type: 'order_summary',
    template: receiptTemplate(sourceTemplate, hasCompleteTotals),
    order: pdfOrder,
    items: pdfItems,
    documentNumber: quoteCode,
    issuedAt: createdAt,
    logoConfig,
    logoArtwork: logoArtwork
      ? Uint8Array.from(Buffer.from(logoArtwork.base64, 'base64'))
      : null
  });

  return {
    bytes,
    filename: `povprasevanje-${quoteCode.toLowerCase()}.pdf`
  };
}
