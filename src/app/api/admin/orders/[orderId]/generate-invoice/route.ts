import { NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/server/blob';
import { withTransaction } from '@/lib/server/db';
import { getNextDocumentNumber, insertDocument } from '@/lib/server/orders';
import { generateInvoicePdf, PdfItem, PdfOrder } from '@/lib/server/pdf';

export async function POST(_request: Request, context: { params: { orderId: string } }) {
  const orderId = context.params.orderId;

  type OrderRow = {
    order_number: string;
    created_at: Date;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    street: string;
    postal_code: string;
    city: string;
    company_name: string | null;
    tax_id_or_vat_id: string | null;
    institution_name: string | null;
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
  };

  type ItemRow = {
    name_snapshot: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  };

  const result = await withTransaction(
    async (client): Promise<{ order: OrderRow; items: ItemRow[]; documentNumber: string } | null> => {
    const orderResult = await client.query<OrderRow>(`select * from orders where id = $1`, [orderId]);
    if (orderResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await client.query<ItemRow>(
      `
        select name_snapshot, unit_price_cents, quantity, line_total_cents
        from order_items
        where order_id = $1
        order by name_snapshot
      `,
      [orderId]
    );

    const nextNumber = await getNextDocumentNumber(client, 'invoice');
    const documentNumber = `RAC-${nextNumber.toString().padStart(5, '0')}`;

    return {
      order: orderResult.rows[0] as OrderRow,
      items: itemsResult.rows,
      documentNumber
    };
  }
  );

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

  const pdfBytes = await generateInvoicePdf(pdfOrder, items, result.documentNumber);
  const filename = `orders/${result.order.order_number}/invoice-${result.documentNumber}.pdf`;
  const uploaded = await uploadBlob(filename, new Blob([pdfBytes]), 'application/pdf');

  await insertDocument(orderId, 'invoice', uploaded.url, result.documentNumber);

  return NextResponse.json({ documentUrl: uploaded.url, documentNumber: result.documentNumber });
}
