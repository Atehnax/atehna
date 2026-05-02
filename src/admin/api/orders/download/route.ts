import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';

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
    const rows: DocRow[] = [];

    const docQuery = typeParam === 'all'
      ? `
      SELECT o.order_number, d.type, d.filename, d.blob_url, d.created_at
      FROM order_documents d
      JOIN orders o ON o.id = d.order_id
      WHERE d.created_at BETWEEN $1 AND $2
        AND d.deleted_at is null
      ORDER BY d.created_at DESC
      `
      : `
      SELECT o.order_number, d.type, d.filename, d.blob_url, d.created_at
      FROM order_documents d
      JOIN orders o ON o.id = d.order_id
      WHERE d.created_at BETWEEN $1 AND $2 AND d.type = $3
        AND d.deleted_at is null
      ORDER BY d.created_at DESC
      `;

    const docParams = typeParam === 'all'
      ? [fromDate.toISOString(), toDate.toISOString()]
      : [fromDate.toISOString(), toDate.toISOString(), typeParam];

    const docResult = await pool.query(docQuery, docParams);
    rows.push(...(docResult.rows as DocRow[]));

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
