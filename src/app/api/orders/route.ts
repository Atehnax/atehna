import { NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/server/blob';
import { createOrder, insertDocument } from '@/lib/server/orders';
import { generateOfferPdf, generatePredracunPdf, PdfItem, PdfOrder } from '@/lib/server/pdf';

type OrderRequest = {
  buyerType: 'individual' | 'company' | 'school';
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  street: string;
  postalCode: string;
  city: string;
  notes?: string;
  companyName?: string;
  taxIdOrVatId?: string;
  institutionName?: string;
  items: {
    sku?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
};

const taxRate = 0.22;

const isValidBuyerType = (value: string): value is OrderRequest['buyerType'] =>
  ['individual', 'company', 'school'].includes(value);

const generateOrderNumber = () => {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${stamp}-${random}`;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as OrderRequest;

  if (!payload || !isValidBuyerType(payload.buyerType)) {
    return NextResponse.json({ error: 'Neveljaven tip kupca.' }, { status: 400 });
  }

  const requiredText = [
    payload.firstName,
    payload.lastName,
    payload.email,
    payload.street,
    payload.postalCode,
    payload.city
  ];

  if (requiredText.some((value) => !value || value.trim().length === 0)) {
    return NextResponse.json({ error: 'Manjkajo obvezna polja.' }, { status: 400 });
  }

  if (payload.buyerType === 'company' && !payload.companyName) {
    return NextResponse.json({ error: 'Naziv podjetja je obvezen.' }, { status: 400 });
  }

  if (payload.buyerType === 'school' && !payload.institutionName) {
    return NextResponse.json({ error: 'Naziv ustanove je obvezen.' }, { status: 400 });
  }

  if (!payload.items || payload.items.length === 0) {
    return NextResponse.json({ error: 'Košarica je prazna.' }, { status: 400 });
  }

  const items: PdfItem[] = payload.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: Math.round(item.unitPrice * 100),
    lineTotalCents: Math.round(item.unitPrice * 100) * item.quantity
  }));

  if (items.some((item) => item.quantity <= 0 || item.unitPriceCents <= 0)) {
    return NextResponse.json({ error: 'Neveljavne postavke.' }, { status: 400 });
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;

  const orderBase = {
    buyerType: payload.buyerType,
    status: payload.buyerType === 'school' ? 'awaiting_purchase_order' : 'awaiting_payment',
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim() || null,
    street: payload.street.trim(),
    postalCode: payload.postalCode.trim(),
    city: payload.city.trim(),
    notes: payload.notes?.trim() || null,
    companyName: payload.companyName?.trim() || null,
    taxIdOrVatId: payload.taxIdOrVatId?.trim() || null,
    institutionName: payload.institutionName?.trim() || null,
    currency: 'eur',
    subtotalCents,
    taxCents,
    totalCents
  };

  let createdOrderId = '';
  let createdAt = new Date();
  let orderNumber = '';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    orderNumber = generateOrderNumber();
    try {
      const created = await createOrder(
        {
          ...orderBase,
          orderNumber
        },
        items.map((item, index) => ({
          sku: payload.items[index]?.sku ?? null,
          nameSnapshot: item.name,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents
        }))
      );
      createdOrderId = created.id;
      createdAt = created.createdAt;
      break;
    } catch (error: any) {
      if (error?.code !== '23505') {
        throw error;
      }
    }
  }

  if (!createdOrderId) {
    return NextResponse.json({ error: 'Ni bilo mogoče ustvariti naročila.' }, { status: 500 });
  }

  const pdfOrder: PdfOrder = {
    orderNumber,
    createdAt,
    buyerName: `${orderBase.firstName} ${orderBase.lastName}`,
    buyerEmail: orderBase.email,
    buyerPhone: orderBase.phone,
    buyerAddress: orderBase.street,
    buyerPostalCode: orderBase.postalCode,
    buyerCity: orderBase.city,
    companyName: orderBase.companyName,
    taxIdOrVatId: orderBase.taxIdOrVatId,
    institutionName: orderBase.institutionName,
    subtotalCents,
    taxCents,
    totalCents
  };

  const documentType = orderBase.buyerType === 'school' ? 'offer' : 'predracun';
  const pdfBytes =
    documentType === 'offer'
      ? await generateOfferPdf(pdfOrder, items)
      : await generatePredracunPdf(pdfOrder, items);

  const filename = `orders/${orderNumber}/${documentType}.pdf`;
  const uploaded = await uploadBlob(filename, new Blob([pdfBytes]), 'application/pdf');

  await insertDocument(createdOrderId, documentType, uploaded.url);

  return NextResponse.json({
    orderId: createdOrderId,
    orderNumber,
    buyerType: orderBase.buyerType,
    status: orderBase.status,
    documentUrl: uploaded.url
  });
}
