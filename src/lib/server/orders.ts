import 'server-only';

import { DbClient, query, withTransaction } from '@/lib/server/db';

export type OrderInsert = {
  orderNumber: string;
  buyerType: 'individual' | 'company' | 'school';
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  street: string;
  postalCode: string;
  city: string;
  notes?: string | null;
  companyName?: string | null;
  taxIdOrVatId?: string | null;
  institutionName?: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export type OrderItemInsert = {
  sku?: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export async function createOrder(
  order: OrderInsert,
  items: OrderItemInsert[]
): Promise<{ id: string; createdAt: Date }> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string; created_at: Date }>(
      `
        insert into orders (
          order_number,
          buyer_type,
          status,
          first_name,
          last_name,
          email,
          phone,
          street,
          postal_code,
          city,
          notes,
          company_name,
          tax_id_or_vat_id,
          institution_name,
          currency,
          subtotal_cents,
          tax_cents,
          total_cents
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
        )
        returning id, created_at
      `,
      [
        order.orderNumber,
        order.buyerType,
        order.status,
        order.firstName,
        order.lastName,
        order.email,
        order.phone ?? null,
        order.street,
        order.postalCode,
        order.city,
        order.notes ?? null,
        order.companyName ?? null,
        order.taxIdOrVatId ?? null,
        order.institutionName ?? null,
        order.currency,
        order.subtotalCents,
        order.taxCents,
        order.totalCents
      ]
    );

    const orderId = result.rows[0].id;

    for (const item of items) {
      await client.query(
        `
          insert into order_items (
            order_id,
            sku,
            name_snapshot,
            unit_price_cents,
            quantity,
            line_total_cents
          ) values ($1, $2, $3, $4, $5, $6)
        `,
        [
          orderId,
          item.sku ?? null,
          item.nameSnapshot,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents
        ]
      );
    }

    return { id: orderId, createdAt: result.rows[0].created_at };
  });
}

export async function insertDocument(
  orderId: string,
  documentType: string,
  fileUrl: string,
  documentNumber?: string | null
) {
  await query(
    `
      insert into documents (order_id, document_type, document_number, file_url)
      values ($1, $2, $3, $4)
    `,
    [orderId, documentType, documentNumber ?? null, fileUrl]
  );
}

export async function insertAttachment(
  orderId: string,
  attachmentType: string,
  fileUrl: string,
  originalFilename?: string | null
) {
  await query(
    `
      insert into attachments (order_id, attachment_type, file_url, original_filename)
      values ($1, $2, $3, $4)
    `,
    [orderId, attachmentType, fileUrl, originalFilename ?? null]
  );
}

export async function updateOrderStatus(orderId: string, status: string, notes?: string | null) {
  if (notes) {
    await query(
      `
        update orders
        set status = $1,
            notes = coalesce(notes, '') || $2,
            updated_at = now()
        where id = $3
      `,
      [status, `\n[ADMIN] ${notes}`, orderId]
    );
    return;
  }

  await query(`update orders set status = $1, updated_at = now() where id = $2`, [
    status,
    orderId
  ]);
}

export async function getNextDocumentNumber(
  client: DbClient,
  counterName: string
): Promise<number> {
  const existing = await client.query<{ next_number: number }>(
    `select next_number from document_counters where counter_name = $1 for update`,
    [counterName]
  );

  if (existing.rows.length === 0) {
    await client.query(
      `insert into document_counters (counter_name, next_number) values ($1, $2)`,
      [counterName, 2]
    );
    return 1;
  }

  const next = existing.rows[0].next_number;
  await client.query(`update document_counters set next_number = $1 where counter_name = $2`, [
    next + 1,
    counterName
  ]);
  return next;
}
