import 'server-only';

import path from 'path';
import { readFile } from 'fs/promises';
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

let pdfLib: typeof import('pdf-lib') | null = null;
async function getPdfLib() {
  if (pdfLib) return pdfLib;
  pdfLib = await import('pdf-lib');
  return pdfLib;
}

let fontkitCached: any | null = null;
async function getFontkit() {
  if (fontkitCached) return fontkitCached;
  const mod: any = await import('@pdf-lib/fontkit');
  fontkitCached = mod.default ?? mod;
  return fontkitCached;
}

type FontBytes = { regular: Uint8Array; bold: Uint8Array | null };
let fontBytesCached: FontBytes | null = null;

async function getFontBytes(): Promise<FontBytes> {
  if (fontBytesCached) return fontBytesCached;

  // recommended: public/fonts (works well in Next/Vercel)
  const regularPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');
  const boldPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf');

  const regular = await readFile(regularPath);
  const bold = await readFile(boldPath).catch(() => null);

  fontBytesCached = {
    regular: new Uint8Array(regular),
    bold: bold ? new Uint8Array(bold) : null
  };

  return fontBytesCached;
}

async function loadFonts(doc: import('pdf-lib').PDFDocument) {
  const fontkit = await getFontkit();
  doc.registerFontkit(fontkit);

  const bytes = await getFontBytes();
  const regular = await doc.embedFont(bytes.regular, { subset: true });
  const bold = bytes.bold ? await doc.embedFont(bytes.bold, { subset: true }) : regular;

  return { regular, bold };
}

function wrapText(
  text: string,
  font: import('pdf-lib').PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [''];

  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function generateOrderPdf(
  title: string,
  order: PdfOrder,
  items: PdfItem[]
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await getPdfLib();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { height } = page.getSize();

  const { regular: font, bold: fontBold } = await loadFonts(doc);

  let y = height - 50;
  const left = 50;
  const right = 50;
  const lineHeight = 16;

  const drawLine = (text: string, isBold = false, size = 10) => {
    page.drawText(text, { x: left, y, size, font: isBold ? fontBold : font });
    y -= 14;
  };

  page.drawText(title, { x: left, y, size: 18, font: fontBold, color: rgb(0.15, 0.15, 0.18) });
  y -= 28;

  const companyLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    `telefon: ${COMPANY_INFO.phone}`,
    `e-pošta: ${COMPANY_INFO.email}`
  ];

  for (const line of companyLines) drawLine(line);

  y -= 8;

  const infoLines = [
    `št. naročila: ${order.orderNumber}`,
    `datum: ${formatDate(order.createdAt)}`,
    `tip naročnika: ${order.customerType}`
  ];

  for (const line of infoLines) drawLine(line);

  const customerTitle = order.organizationName
    ? `organizacija: ${order.organizationName}`
    : `naročnik: ${order.contactName}`;

  drawLine(customerTitle, true);

  const contactLines = [
    `kontakt: ${order.contactName}`,
    `e-pošta: ${order.email}`,
    order.phone ? `telefon: ${order.phone}` : null,
    order.deliveryAddress ? `naslov dostave: ${order.deliveryAddress}` : null,
    order.reference ? `sklic: ${order.reference}` : null
  ].filter(Boolean) as string[];

  for (const line of contactLines) drawLine(line);

  y -= 6;

  page.drawText('postavke', { x: left, y, size: 11, font: fontBold });
  y -= 18;

  const columns = [
    { title: 'sku', width: 90 },
    { title: 'izdelek', width: 250 },
    { title: 'količina', width: 80 },
    { title: 'enota', width: 70 },
    { title: 'cena', width: 80 }
  ];

  let x = left;
  for (const col of columns) {
    page.drawText(col.title, { x, y, size: 9, font: fontBold });
    x += col.width;
  }

  y -= 12;

  const tableMaxWidth = 595.28 - left - right;

  for (const item of items) {
    // basic page-bottom guard
    if (y < 80) break;

    const sku = item.sku ?? '';
    const name = item.name ?? '';
    const quantity = String(item.quantity ?? 0);
    const unit = item.unit ?? '-';
    const priceLabel = item.unitPrice ? formatCurrency(item.unitPrice) : 'po dogovoru';

    const nameLines = wrapText(name, font, 9, columns[1].width - 6);
    const rowHeight = Math.max(1, nameLines.length) * 12;

    if (y - rowHeight < 80) break;

    // sku
    x = left;
    page.drawText(sku, { x, y, size: 9, font });

    // name (wrapped)
    x += columns[0].width;
    for (let i = 0; i < nameLines.length; i++) {
      page.drawText(nameLines[i], { x, y: y - i * 12, size: 9, font });
    }

    // quantity
    x += columns[1].width;
    page.drawText(quantity, { x, y, size: 9, font });

    // unit
    x += columns[2].width;
    page.drawText(unit, { x, y, size: 9, font });

    // price
    x += columns[3].width;
    page.drawText(priceLabel, { x, y, size: 9, font });

    y -= rowHeight;
  }

  y -= 8;

  if (order.subtotal > 0 || order.total > 0) {
    const totals = [
      `vmesni seštevek: ${formatCurrency(order.subtotal)}`,
      `ddv: ${formatCurrency(order.tax)}`,
      `skupaj: ${formatCurrency(order.total)}`
    ];

    for (const line of totals) drawLine(line, true);
  } else {
    drawLine('cene bodo določene ob potrditvi ponudbe.');
  }

  if (order.notes) {
    y -= 4;
    page.drawText('opombe:', { x: left, y, size: 10, font: fontBold });
    y -= 14;

    const noteLines = wrapText(order.notes, font, 9, tableMaxWidth);
    for (const line of noteLines) {
      if (y < 60) break;
      page.drawText(line, { x: left, y, size: 9, font });
      y -= 12;
    }
  }

  return doc.save();
}
