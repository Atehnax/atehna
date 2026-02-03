import 'server-only';

import { COMPANY_INFO } from '@/lib/constants';

type PdfItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type PdfOrder = {
  orderNumber: string;
  createdAt: Date;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  buyerAddress: string;
  buyerPostalCode: string;
  buyerCity: string;
  companyName?: string | null;
  taxIdOrVatId?: string | null;
  institutionName?: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

const formatCurrency = (amountCents: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(
    amountCents / 100
  );

const formatDate = (date: Date) => date.toLocaleDateString('sl-SI');

const drawLines = (page: any, lines: string[], x: number, y: number, size = 11) => {
  const lineHeight = size + 4;
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size });
  });
  return y - lines.length * lineHeight;
};

const buildItemsTable = (items: PdfItem[]) =>
  items.map((item) => [
    item.name,
    `${item.quantity} × ${formatCurrency(item.unitPriceCents)}`,
    formatCurrency(item.lineTotalCents)
  ]);

async function createBaseDocument(title: string) {
  const { PDFDocument, StandardFonts } = await (0, eval)('import("pdf-lib")');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.setFont(font);
  page.setFontSize(11);

  page.drawText(title, { x: 40, y: 800, size: 18, font: bold });
  page.drawText(COMPANY_INFO.name, { x: 40, y: 770, size: 12, font: bold });

  const sellerLines = [
    COMPANY_INFO.address,
    `T: ${COMPANY_INFO.phone}`,
    `E: ${COMPANY_INFO.orderEmail}`,
    `IBAN: ${COMPANY_INFO.iban}`,
    `Banka: ${COMPANY_INFO.bank}`,
    `Davčna št.: ${COMPANY_INFO.taxId}`
  ];

  drawLines(page, sellerLines, 40, 750, 10);

  return { pdfDoc, page, font, bold };
}

export async function generatePredracunPdf(order: PdfOrder, items: PdfItem[]) {
  const { pdfDoc, page, bold } = await createBaseDocument('Predračun');

  page.drawText(`Št. naročila: ${order.orderNumber}`, { x: 40, y: 700, font: bold });
  page.drawText(`Datum izdaje: ${formatDate(order.createdAt)}`, { x: 40, y: 684 });

  const deadline = new Date(order.createdAt);
  deadline.setDate(deadline.getDate() + 8);
  page.drawText(`Rok plačila: ${formatDate(deadline)}`, { x: 40, y: 668 });

  const buyerLines = [
    `Kupec: ${order.buyerName}`,
    order.companyName ? `Podjetje: ${order.companyName}` : null,
    order.institutionName ? `Ustanova: ${order.institutionName}` : null,
    order.taxIdOrVatId ? `DDV/Davčna: ${order.taxIdOrVatId}` : null,
    `Email: ${order.buyerEmail}`,
    order.buyerPhone ? `Telefon: ${order.buyerPhone}` : null,
    `Naslov: ${order.buyerAddress}, ${order.buyerPostalCode} ${order.buyerCity}`
  ].filter(Boolean) as string[];

  drawLines(page, buyerLines, 40, 640, 10);

  let y = 560;
  page.drawText('Artikli', { x: 40, y, font: bold });
  page.drawText('Količina × cena', { x: 300, y, font: bold });
  page.drawText('Skupaj', { x: 470, y, font: bold });
  y -= 16;

  buildItemsTable(items).forEach((row) => {
    page.drawText(row[0], { x: 40, y });
    page.drawText(row[1], { x: 300, y });
    page.drawText(row[2], { x: 470, y });
    y -= 16;
  });

  y -= 12;
  page.drawText(`Vmesna vsota: ${formatCurrency(order.subtotalCents)}`, { x: 350, y });
  y -= 16;
  page.drawText(`DDV: ${formatCurrency(order.taxCents)}`, { x: 350, y });
  y -= 18;
  page.drawText(`Skupaj: ${formatCurrency(order.totalCents)}`, { x: 350, y, font: bold });

  page.drawText(`Sklic: ${order.orderNumber}`, { x: 40, y: 120 });

  return pdfDoc.save();
}

export async function generateOfferPdf(order: PdfOrder, items: PdfItem[]) {
  const { pdfDoc, page, bold } = await createBaseDocument('Povzetek naročila / Ponudba');

  page.drawText(`Št. naročila: ${order.orderNumber}`, { x: 40, y: 700, font: bold });
  page.drawText(`Datum: ${formatDate(order.createdAt)}`, { x: 40, y: 684 });

  const buyerLines = [
    `Kupec: ${order.buyerName}`,
    order.institutionName ? `Ustanova: ${order.institutionName}` : null,
    `Email: ${order.buyerEmail}`,
    order.buyerPhone ? `Telefon: ${order.buyerPhone}` : null,
    `Naslov: ${order.buyerAddress}, ${order.buyerPostalCode} ${order.buyerCity}`
  ].filter(Boolean) as string[];

  drawLines(page, buyerLines, 40, 640, 10);

  let y = 560;
  page.drawText('Artikli', { x: 40, y, font: bold });
  page.drawText('Količina × cena', { x: 300, y, font: bold });
  page.drawText('Skupaj', { x: 470, y, font: bold });
  y -= 16;

  buildItemsTable(items).forEach((row) => {
    page.drawText(row[0], { x: 40, y });
    page.drawText(row[1], { x: 300, y });
    page.drawText(row[2], { x: 470, y });
    y -= 16;
  });

  y -= 12;
  page.drawText(`Vmesna vsota: ${formatCurrency(order.subtotalCents)}`, { x: 350, y });
  y -= 16;
  page.drawText(`DDV: ${formatCurrency(order.taxCents)}`, { x: 350, y });
  y -= 18;
  page.drawText(`Skupaj: ${formatCurrency(order.totalCents)}`, { x: 350, y, font: bold });

  drawLines(
    page,
    [
      'Prosimo, da uradno naročilnico naložite v portal.',
      `Pri sklicu navedite številko naročila: ${order.orderNumber}.`
    ],
    40,
    120,
    10
  );

  return pdfDoc.save();
}

export async function generateDobavnicaPdf(order: PdfOrder, items: PdfItem[], docNumber: string) {
  const { pdfDoc, page, bold } = await createBaseDocument('Dobavnica');

  page.drawText(`Št. dobavnice: ${docNumber}`, { x: 40, y: 700, font: bold });
  page.drawText(`Št. naročila: ${order.orderNumber}`, { x: 40, y: 684 });
  page.drawText(`Datum: ${formatDate(order.createdAt)}`, { x: 40, y: 668 });

  let y = 600;
  page.drawText('Artikli', { x: 40, y, font: bold });
  page.drawText('Količina', { x: 400, y, font: bold });
  y -= 16;

  items.forEach((item) => {
    page.drawText(item.name, { x: 40, y });
    page.drawText(`${item.quantity}`, { x: 400, y });
    y -= 16;
  });

  return pdfDoc.save();
}

export async function generateInvoicePdf(order: PdfOrder, items: PdfItem[], docNumber: string) {
  const { pdfDoc, page, bold } = await createBaseDocument('Račun');

  page.drawText(`Št. računa: ${docNumber}`, { x: 40, y: 700, font: bold });
  page.drawText(`Št. naročila: ${order.orderNumber}`, { x: 40, y: 684 });
  page.drawText(`Datum: ${formatDate(order.createdAt)}`, { x: 40, y: 668 });

  let y = 560;
  page.drawText('Artikli', { x: 40, y, font: bold });
  page.drawText('Količina × cena', { x: 300, y, font: bold });
  page.drawText('Skupaj', { x: 470, y, font: bold });
  y -= 16;

  buildItemsTable(items).forEach((row) => {
    page.drawText(row[0], { x: 40, y });
    page.drawText(row[1], { x: 300, y });
    page.drawText(row[2], { x: 470, y });
    y -= 16;
  });

  y -= 12;
  page.drawText(`Vmesna vsota: ${formatCurrency(order.subtotalCents)}`, { x: 350, y });
  y -= 16;
  page.drawText(`DDV: ${formatCurrency(order.taxCents)}`, { x: 350, y });
  y -= 18;
  page.drawText(`Skupaj: ${formatCurrency(order.totalCents)}`, { x: 350, y, font: bold });

  return pdfDoc.save();
}

export type { PdfOrder, PdfItem };
