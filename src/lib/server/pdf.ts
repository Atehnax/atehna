import path from 'path';
import fs from 'fs/promises';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY_INFO } from '@/lib/constants';
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from '@/lib/server/pdfFontData';

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

const toNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

let cachedFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadFonts() {
  if (cachedFonts) return cachedFonts;

  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  await fs.mkdir(fontDir, { recursive: true });

  const regularPath = path.join(fontDir, 'NotoSans-Regular.ttf');
  const boldPath = path.join(fontDir, 'NotoSans-Bold.ttf');

  try {
    await fs.access(regularPath);
    await fs.access(boldPath);
  } catch {
    await fs.writeFile(regularPath, Buffer.from(NOTO_SANS_REGULAR_BASE64, 'base64'));
    await fs.writeFile(boldPath, Buffer.from(NOTO_SANS_BOLD_BASE64, 'base64'));
  }

  try {
    const [regular, bold] = await Promise.all([fs.readFile(regularPath), fs.readFile(boldPath)]);
    cachedFonts = { regular, bold };
    return cachedFonts;
  } catch {
    return null;
  }
}

export async function generateOrderPdf(
  title: string,
  order: PdfOrder,
  items: PdfItem[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let font;
  let fontBold;

  try {
    const fonts = await loadFonts();
    if (fonts) {
      font = await doc.embedFont(fonts.regular, { subset: true });
      fontBold = await doc.embedFont(fonts.bold, { subset: true });
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica);
      fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    }
  } catch {
    font = await doc.embedFont(StandardFonts.Helvetica);
    fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const page = doc.addPage([595.28, 841.89]);
  const { height } = page.getSize();

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
  columns.forEach((column) => {
    page.drawText(column.title, { x, y, size: 9, font: fontBold });
    x += column.width;
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

    page.drawText(formatCurrency(toNumber(item.unitPrice)), { x, y, size: 9, font });

    y -= lineHeight;
  });

  y -= 8;

  // Always numeric totals (no fallback text)
  const totals = [
    `Vmesni seštevek: ${formatCurrency(toNumber(order.subtotal))}`,
    `DDV: ${formatCurrency(toNumber(order.tax))}`,
    `Skupaj: ${formatCurrency(toNumber(order.total))}`
  ];

  totals.forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font: fontBold });
    y -= 14;
  });

  if (order.notes) {
    y -= 4;
    page.drawText('Opombe:', { x: left, y, size: 10, font: fontBold });
    y -= 14;
    page.drawText(order.notes, { x: left, y, size: 9, font });
  }

  return doc.save();
}
