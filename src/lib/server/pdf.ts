import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

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

let regularFontBytesPromise: Promise<Uint8Array> | null = null;
let boldFontBytesPromise: Promise<Uint8Array> | null = null;

async function loadFontBytes(fileName: string): Promise<Uint8Array> {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
  const fontBuffer = await readFile(fontPath);
  return new Uint8Array(fontBuffer);
}

function getRegularFontBytes(): Promise<Uint8Array> {
  if (!regularFontBytesPromise) {
    regularFontBytesPromise = loadFontBytes('NotoSans-Regular.ttf');
  }
  return regularFontBytesPromise;
}

function getBoldFontBytes(): Promise<Uint8Array> {
  if (!boldFontBytesPromise) {
    boldFontBytesPromise = loadFontBytes('NotoSans-Bold.ttf');
  }
  return boldFontBytesPromise;
}

function wrapTextByWidth(
  inputText: string,
  maxWidth: number,
  fontSize: number,
  measureTextWidth: (text: string, size: number) => number
): string[] {
  const words = inputText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidateLine = `${currentLine} ${words[index]}`;
    if (measureTextWidth(candidateLine, fontSize) <= maxWidth) {
      currentLine = candidateLine;
    } else {
      lines.push(currentLine);
      currentLine = words[index];
    }
  }

  lines.push(currentLine);
  return lines;
}

export async function generateOrderPdf(
  title: string,
  order: PdfOrder,
  items: PdfItem[]
): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.registerFontkit(fontkit);

  const [regularFontBytes, boldFontBytes] = await Promise.all([
    getRegularFontBytes(),
    getBoldFontBytes()
  ]);

  const regularFont = await pdfDocument.embedFont(regularFontBytes, { subset: true });
  const boldFont = await pdfDocument.embedFont(boldFontBytes, { subset: true });

  const page = pdfDocument.addPage([595.28, 841.89]);
  const pageSize = page.getSize();

  let cursorY = pageSize.height - 50;
  const leftMargin = 50;
  const lineHeight = 16;

  page.drawText(title, {
    x: leftMargin,
    y: cursorY,
    size: 18,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.18)
  });
  cursorY -= 28;

  const companyLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    `Telefon: ${COMPANY_INFO.phone}`,
    `E-pošta: ${COMPANY_INFO.email}`
  ];

  companyLines.forEach((line) => {
    page.drawText(line, { x: leftMargin, y: cursorY, size: 10, font: regularFont });
    cursorY -= 14;
  });

  cursorY -= 8;

  const infoLines = [
    `Št. naročila: ${order.orderNumber}`,
    `Datum: ${formatDate(order.createdAt)}`,
    `Tip naročnika: ${order.customerType}`
  ];

  infoLines.forEach((line) => {
    page.drawText(line, { x: leftMargin, y: cursorY, size: 10, font: regularFont });
    cursorY -= 14;
  });

  const customerTitle = order.organizationName
    ? `Organizacija: ${order.organizationName}`
    : `Naročnik: ${order.contactName}`;

  page.drawText(customerTitle, { x: leftMargin, y: cursorY, size: 10, font: boldFont });
  cursorY -= 16;

  const contactLines = [
    `Kontakt: ${order.contactName}`,
    `E-pošta: ${order.email}`,
    order.phone ? `Telefon: ${order.phone}` : null,
    order.deliveryAddress ? `Naslov dostave: ${order.deliveryAddress}` : null,
    order.reference ? `Sklic: ${order.reference}` : null
  ].filter(Boolean) as string[];

  contactLines.forEach((line) => {
    page.drawText(line, { x: leftMargin, y: cursorY, size: 10, font: regularFont });
    cursorY -= 14;
  });

  cursorY -= 6;

  page.drawText('Postavke', { x: leftMargin, y: cursorY, size: 11, font: boldFont });
  cursorY -= 18;

  const columns = [
    { title: 'SKU', width: 90 },
    { title: 'Izdelek', width: 250 },
    { title: 'Količina', width: 80 },
    { title: 'Enota', width: 70 },
    { title: 'Cena', width: 80 }
  ];

  let cursorX = leftMargin;
  columns.forEach((column) => {
    page.drawText(column.title, { x: cursorX, y: cursorY, size: 9, font: boldFont });
    cursorX += column.width;
  });

  cursorY -= 12;

  items.forEach((item) => {
    cursorX = leftMargin;
    page.drawText(item.sku, { x: cursorX, y: cursorY, size: 9, font: regularFont });

    cursorX += columns[0].width;
    page.drawText(item.name, { x: cursorX, y: cursorY, size: 9, font: regularFont });

    cursorX += columns[1].width;
    page.drawText(String(item.quantity), { x: cursorX, y: cursorY, size: 9, font: regularFont });

    cursorX += columns[2].width;
    page.drawText(item.unit ?? '-', { x: cursorX, y: cursorY, size: 9, font: regularFont });

    cursorX += columns[3].width;
    const priceLabel =
      item.unitPrice !== null && item.unitPrice !== undefined
        ? formatCurrency(item.unitPrice)
        : 'Po dogovoru';
    page.drawText(priceLabel, { x: cursorX, y: cursorY, size: 9, font: regularFont });

    cursorY -= lineHeight;
  });

  cursorY -= 8;

  if (order.subtotal > 0 || order.total > 0) {
    const totals = [
      `Vmesni seštevek: ${formatCurrency(order.subtotal)}`,
      `DDV: ${formatCurrency(order.tax)}`,
      `Skupaj: ${formatCurrency(order.total)}`
    ];

    totals.forEach((line) => {
      page.drawText(line, { x: leftMargin, y: cursorY, size: 10, font: boldFont });
      cursorY -= 14;
    });
  } else {
    page.drawText('Cene bodo določene ob potrditvi ponudbe.', {
      x: leftMargin,
      y: cursorY,
      size: 10,
      font: regularFont
    });
    cursorY -= 14;
  }

  if (order.notes) {
    cursorY -= 4;
    page.drawText('Opombe:', { x: leftMargin, y: cursorY, size: 10, font: boldFont });
    cursorY -= 14;

    const wrappedNoteLines = wrapTextByWidth(
      order.notes,
      pageSize.width - leftMargin * 2,
      9,
      (text, size) => regularFont.widthOfTextAtSize(text, size)
    );

    wrappedNoteLines.forEach((line) => {
      page.drawText(line, { x: leftMargin, y: cursorY, size: 9, font: regularFont });
      cursorY -= 12;
    });
  }

  return pdfDocument.save();
}
