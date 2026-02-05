import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type DocRow = {
  order_number: string;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type AttachmentRow = {
  order_number: string;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type QueryRowsResult<T> = {
  rows: T[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const typeParam = searchParams.get('type') ?? 'all';

    if (!fromParam || !toParam) {
      return NextResponse.json({ message: 'Manjkata datuma.' }, { status: 400 });
    }

    const fromDate = parseDate(fromParam);
    const toDate = parseDate(toParam);

    if (!fromDate || !toDate) {
      return NextResponse.json({ message: 'Neveljaven format datuma.' }, { status: 400 });
    }

    const pool = await getPool();
    const rows: Array<DocRow | AttachmentRow> = [];

    if (typeParam === 'all' || typeParam === 'purchase_order') {
      const attachmentResult = (await pool.query(
        `
        select order_table.order_number, attachment.type, attachment.filename, attachment.blob_url, attachment.created_at
        from order_attachments attachment
        join orders order_table on order_table.id = attachment.order_id
        where attachment.created_at between $1 and $2
        order by attachment.created_at desc
        `,
        [fromDate.toISOString(), toDate.toISOString()]
      )) as QueryRowsResult<AttachmentRow>;

      rows.push(
        ...attachmentResult.rows.map((row) => ({
          ...row,
          type: 'purchase_order'
        }))
      );
    }

    if (typeParam !== 'purchase_order') {
      const docQuery =
        typeParam === 'all'
          ? `
        select order_table.order_number, document.type, document.filename, document.blob_url, document.created_at
        from order_documents document
        join orders order_table on order_table.id = document.order_id
        where document.created_at between $1 and $2
        order by document.created_at desc
        `
          : `
        select order_table.order_number, document.type, document.filename, document.blob_url, document.created_at
        from order_documents document
        join orders order_table on order_table.id = document.order_id
        where document.created_at between $1 and $2 and document.type = $3
        order by document.created_at desc
        `;

      const docParams =
        typeParam === 'all'
          ? [fromDate.toISOString(), toDate.toISOString()]
          : [fromDate.toISOString(), toDate.toISOString(), typeParam];

      const docResult = (await pool.query(docQuery, docParams)) as QueryRowsResult<DocRow>;
      rows.push(...docResult.rows);
    }

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Ni dokumentov za izbran interval.' }, { status: 404 });
    }

    const payload = rows.map((row) => ({
      orderNumber: row.order_number,
      type: row.type,
      filename: row.filename,
      url: row.blob_url,
      createdAt: row.created_at
    }));

    return NextResponse.json({ items: payload });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
