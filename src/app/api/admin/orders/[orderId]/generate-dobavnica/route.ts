import { NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/server/blob';
import { withTransaction } from '@/lib/server/db';
import { getNextDocumentNumber, insertDocument } from '@/lib/server/orders';
import { generateDobavnicaPdf, PdfItem, PdfOrder } from '@/lib/server/pdf';

export async function POST(_request: Request, context: { params: { orderId: string } }) {
  const orderId = context.params.orderId;

  const result = await withTransaction(async (client) => {
    const orderResult = await client.query(
      `
        select * from orders where id = $1
      `,
      [orderId]
    );
    if (orderResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await client.query(
      `
        select name_snapshot, unit_price_cents, quantity, line_total_cents
        from order_items
        where order_id = $1
        order by name_snapshot
      `,
      [orderId]
    );

    const nextNumber = await getNextDocumentNumber(client, 'dobavnica');
    const documentNumber = `DOB-${nextNumber.toString().padStart(5, '0')}`;

    return {
      order: orderResult.rows[0],
      items: itemsResult.rows,
      documentNumber
    };
  });

  if (!result) {
    return NextResponse.json({ error: 'Naročilo ne obstaja.' }, { status: 404 });
  }

  const pdfOrder: PdfOrder = {
    orderNumber: result.order.order_number,
    createdAt: new Date(result.order.created_at),
    buyerName: `${result.order.first_name} ${result.order.last_name}`,
    buyerEmail: result.order.email,
    buyerPhone: result.order.phone,
    buyerAddress: result.order.street,
    buyerPostalCode: result.order.postal_code,
    buyerCity: result.order.city,
    companyName: result.order.company_name,
    taxIdOrVatId: result.order.tax_id_or_vat_id,
    institutionName: result.order.institution_name,
    subtotalCents: Number(result.order.subtotal_cents),
    taxCents: Number(result.order.tax_cents),
    totalCents: Number(result.order.total_cents)
  };

  const items: PdfItem[] = result.items.map((item: any) => ({
    name: item.name_snapshot,
    quantity: Number(item.quantity),
    unitPriceCents: Number(item.unit_price_cents),
    lineTotalCents: Number(item.line_total_cents)
  }));

  const pdfBytes = await generateDobavnicaPdf(pdfOrder, items, result.documentNumber);
  const filename = `orders/${result.order.order_number}/dobavnica-${result.documentNumber}.pdf`;
  const uploaded = await uploadBlob(filename, new Blob([pdfBytes]), 'application/pdf');

  await insertDocument(orderId, 'dobavnica', uploaded.url, result.documentNumber);

  return NextResponse.json({ documentUrl: uploaded.url, documentNumber: result.documentNumber });
}
