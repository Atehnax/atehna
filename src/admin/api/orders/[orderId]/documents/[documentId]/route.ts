import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';

async function ensureArchiveSchema() {
  const pool = await getPool();
  await pool.query('alter table if exists orders add column if not exists deleted_at timestamptz');
  await pool.query('alter table if exists order_documents add column if not exists deleted_at timestamptz');
  await pool.query(`
    create table if not exists deleted_archive_entries (
      id bigserial primary key,
      item_type text not null check (item_type in ('order', 'pdf')),
      order_id bigint,
      document_id bigint,
      label text not null,
      deleted_at timestamptz not null default now(),
      expires_at timestamptz not null default (now() + interval '90 days'),
      payload jsonb not null default '{}'::jsonb
    )
  `);
}


async function hasDocumentsDeletedAtColumn() {
  const pool = await getPool();
  const result = await pool.query(
    `
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_documents'
      and column_name = 'deleted_at'
    limit 1
    `
  );
  return Number(result.rowCount ?? 0) > 0;
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ orderId: string; documentId: string }> }
) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    const documentId = Number(params.documentId);

    if (!Number.isFinite(orderId) || !Number.isFinite(documentId)) {
      return NextResponse.json({ message: 'Neveljaven ID.' }, { status: 400 });
    }

    const pool = await getPool();
    await ensureArchiveSchema();
    const supportsSoftDelete = await hasDocumentsDeletedAtColumn();

    const documentResult = await pool.query(
      supportsSoftDelete
        ? `
          select d.id, d.type, d.filename, d.blob_url, d.blob_pathname, d.deleted_at,
            o.contact_name, o.delivery_address, o.customer_type, o.created_at
          from order_documents d
          left join orders o on o.id = d.order_id
          where d.id = $1 and d.order_id = $2
        `
        : `
          select d.id, d.type, d.filename, d.blob_url, d.blob_pathname, null::timestamptz as deleted_at,
            o.contact_name, o.delivery_address, o.customer_type, o.created_at
          from order_documents d
          left join orders o on o.id = d.order_id
          where d.id = $1 and d.order_id = $2
        `,
      [documentId, orderId]
    );

    if (documentResult.rows.length === 0) {
      return NextResponse.json({ message: 'Dokument ne obstaja.' }, { status: 404 });
    }

    const row = documentResult.rows[0] as {
      type: string;
      filename: string;
      blob_url: string;
      blob_pathname: string | null;
      contact_name: string | null;
      delivery_address: string | null;
      customer_type: string | null;
      created_at: string | null;
      deleted_at: string | null;
    };

    if (row.deleted_at) {
      return NextResponse.json({ success: true });
    }

    if (supportsSoftDelete) {
      await pool.query('update order_documents set deleted_at = now() where id = $1 and order_id = $2', [documentId, orderId]);

      try {
        await pool.query(
          `
          insert into deleted_archive_entries (item_type, order_id, document_id, label, payload)
          values ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            'pdf',
            orderId,
            documentId,
            row.filename,
            JSON.stringify({
              type: row.type,
              blobUrl: row.blob_url,
              blobPathname: row.blob_pathname,
              orderCreatedAt: row.created_at,
              customerName: row.contact_name || null,
              address: row.delivery_address || null,
              customerType: row.customer_type || null
            })
          ]
        );
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === '42P01')) {
          throw error;
        }
      }

      return NextResponse.json({ success: true });
    }

    await pool.query('delete from order_documents where id = $1 and order_id = $2', [documentId, orderId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
