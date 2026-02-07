import path from 'path';
import fs from 'fs/promises';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
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

const toNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toSafeText = (value: unknown) =>
  String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let cachedFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function readFileIfExists(filePath: string): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function loadFontsFromPublic(): Promise<{ regular: Uint8Array; bold: Uint8Array } | null> {
  if (cachedFonts) return cachedFonts;

  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const regularPath = path.join(fontDir, 'NotoSans-Regular.ttf');
  const boldPath = path.join(fontDir, 'NotoSans-Bold.ttf');

  const [regular, bold] = await Promise.all([
    readFileIfExists(regularPath),
    readFileIfExists(boldPath)
  ]);

  if (!regular || !bold) return null;

  // Basic sanity guard: avoid embedding broken tiny files.
  if (regular.length < 1024 || bold.length < 1024) return null;

  cachedFonts = { regular, bold };
  return cachedFonts;
}

function clampText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const safe = toSafeText(text);
  if (!safe) return '-';
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;

  let result = safe;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export async function generateOrderPdf(
  title: string,
  order: PdfOrder,
  items: PdfItem[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  let font: PDFFont;
  let fontBold: PDFFont;

  try {
    doc.registerFontkit(fontkit);
    const fonts = await loadFontsFromPublic();

    if (fonts) {
      // subset: false to avoid glyph/subset weirdness while debugging scattered letters
      font = await doc.embedFont(fonts.regular, { subset: false });
      fontBold = await doc.embedFont(fonts.bold, { subset: false });
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

  page.drawText(toSafeText(title), {
    x: left,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.18)
  });
  y -= 28;

  const companyLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    `Telefon: ${COMPANY_INFO.phone}`,
    `E-pošta: ${COMPANY_INFO.email}`
  ];

  companyLines.forEach((line) => {
    page.drawText(toSafeText(line), { x: left, y, size: 10, font });
    y -= 14;
  });

  y -= 8;

  const infoLines = [
    `Št. naročila: ${toSafeText(order.orderNumber)}`,
    `Datum: ${formatDate(order.createdAt)}`,
    `Tip naročnika: ${toSafeText(order.customerType)}`
  ];

  infoLines.forEach((line) => {
    page.drawText(line, { x: left, y, size: 10, font });
    y -= 14;
  });

  const customerTitle = order.organizationName
    ? `Organizacija: ${toSafeText(order.organizationName)}`
    : `Naročnik: ${toSafeText(order.contactName)}`;

  page.drawText(customerTitle, { x: left, y, size: 10, font: fontBold });
  y -= 16;

  const contactLines = [
    `Kontakt: ${toSafeText(order.contactName)}`,
    `E-pošta: ${toSafeText(order.email)}`,
    order.phone ? `Telefon: ${toSafeText(order.phone)}` : null,
    order.deliveryAddress ? `Naslov dostave: ${toSafeText(order.deliveryAddress)}` : null,
    order.reference ? `Sklic: ${toSafeText(order.reference)}` : null
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

  for (const item of items) {
    // crude page break for long orders
    if (y < 80) {
      const newPage = doc.addPage([595.28, 841.89]);
      y = newPage.getSize().height - 50;

      x = left;
      columns.forEach((column) => {
        newPage.drawText(column.title, { x, y, size: 9, font: fontBold });
        x += column.width;
      });
      y -= 12;

      x = left;
      newPage.drawText(
        clampText(font, toSafeText(item.sku), 9, columns[0].width - 6),
        { x, y, size: 9, font }
      );
      x += columns[0].width;

      newPage.drawText(
        clampText(font, toSafeText(item.name), 9, columns[1].width - 6),
        { x, y, size: 9, font }
      );
      x += columns[1].width;

      newPage.drawText(String(item.quantity), { x, y, size: 9, font });
      x += columns[2].width;

      newPage.drawText(clampText(font, item.unit ?? '-', 9, columns[3].width - 6), {
        x,
        y,
        size: 9,
        font
      });
      x += columns[3].width;

      newPage.drawText(formatCurrency(toNumber(item.unitPrice)), { x, y, size: 9, font });

      y -= lineHeight;
      continue;
    }

    x = left;
    page.drawText(
      clampText(font, toSafeText(item.sku), 9, columns[0].width - 6),
      { x, y, size: 9, font }
    );
    x += columns[0].width;

    page.drawText(
      clampText(font, toSafeText(item.name), 9, columns[1].width - 6),
      { x, y, size: 9, font }
    );
    x += columns[1].width;

    page.drawText(String(item.quantity), { x, y, size: 9, font });
    x += columns[2].width;

    page.drawText(clampText(font, item.unit ?? '-', 9, columns[3].width - 6), {
      x,
      y,
      size: 9,
      font
    });
    x += columns[3].width;

    page.drawText(formatCurrency(toNumber(item.unitPrice)), { x, y, size: 9, font });

    y -= lineHeight;
  }

  y -= 8;

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
    page.drawText(clampText(font, toSafeText(order.notes), 9, 480), {
      x: left,
      y,
      size: 9,
      font
    });
  }

  return doc.save();
}
