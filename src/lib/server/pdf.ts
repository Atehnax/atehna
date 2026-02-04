import { COMPANY_INFO } from '@/lib/constants';

export type PdfItem = {
  sku: string;
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
};

export type PdfOrder = {
  orderNumber: string;
  customerType: string;
  organizationName?: string | null;
  contactName: string;
  email: string;
  phone?: string | null;
  deliveryAddress?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: Date;
  subtotal: number;
  tax: number;
  total: number;
};

const locale = 'sl-SI';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);

async function getPdfLib() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const moduleName = 'pdf-lib';
  return require(moduleName) as typeof import('pdf-lib');
}

export async function generateOrderPdf(
  title: string,
  order: PdfOrder,
  items: PdfItem[]
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const left = 50;
  const lineHeight = 16;

  page.drawText(title, { x: left, y, size: 18, font: fontBold, color: rgb(0.15, 0.15, 0.18) });
  y -= 28;

  const companyLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    `Telefon: ${COMPANY_INFO.phone}`,
    `E-pošta: ${COMPANY_INFO.email}`
  ];

  companyLines.forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font });
    y -= 14;
  });

  y -= 8;

  const infoLines = [
    `Št. naročila: ${order.orderNumber}`,
    `Datum: ${formatDate(order.createdAt)}`,
    `Tip naročnika: ${order.customerType}`
  ];

  infoLines.forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font });
    y -= 14;
  });

  const customerTitle = order.organizationName
    ? `Organizacija: ${order.organizationName}`
    : `Naročnik: ${order.contactName}`;

  page.drawText(customerTitle, { x: left, y, size: 10, font: fontBold });
  y -= 16;

  const contactLines = [
    `Kontakt: ${order.contactName}`,
    `E-pošta: ${order.email}`,
    order.phone ? `Telefon: ${order.phone}` : null,
    order.deliveryAddress ? `Naslov dostave: ${order.deliveryAddress}` : null,
    order.reference ? `Sklic: ${order.reference}` : null
  ].filter(Boolean) as string[];

  contactLines.forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font });
    y -= 14;
  });

  y -= 6;

  page.drawText('Postavke', { x: left, y, size: 11, font: fontBold });
  y -= 18;

  const columns = [
    { title: 'SKU', width: 90 },
    { title: 'Izdelek', width: 250 },
    { title: 'Količina', width: 80 },
    { title: 'Enota', width: 70 },
    { title: 'Cena', width: 80 }
  ];

  let x = left;
  columns.forEach((col) => {
    page.drawText(col.title, { x, y, size: 9, font: fontBold });
    x += col.width;
  });

  y -= 12;

  items.forEach((item) => {
    x = left;
    page.drawText(item.sku, { x, y, size: 9, font });
    x += columns[0].width;
    page.drawText(item.name, { x, y, size: 9, font });
    x += columns[1].width;
    page.drawText(String(item.quantity), { x, y, size: 9, font });
    x += columns[2].width;
    page.drawText(item.unit ?? '-', { x, y, size: 9, font });
    x += columns[3].width;
    const priceLabel = item.unitPrice ? formatCurrency(item.unitPrice) : 'Po dogovoru';
    page.drawText(priceLabel, { x, y, size: 9, font });
    y -= lineHeight;
  });

  y -= 8;

  if (order.subtotal > 0 || order.total > 0) {
    const totals = [
      `Vmesni seštevek: ${formatCurrency(order.subtotal)}`,
      `DDV: ${formatCurrency(order.tax)}`,
      `Skupaj: ${formatCurrency(order.total)}`
    ];

    totals.forEach((line) => {
      page.drawText(line, { x: left, y, size: 10, font: fontBold });
      y -= 14;
    });
  } else {
    page.drawText('Cene bodo določene ob potrditvi ponudbe.', {
      x: left,
      y,
      size: 10,
      font
    });
    y -= 14;
  }

  if (order.notes) {
    y -= 4;
    page.drawText('Opombe:', { x: left, y, size: 10, font: fontBold });
    y -= 14;
    page.drawText(order.notes, { x: left, y, size: 9, font });
  }

  return doc.save();
}
