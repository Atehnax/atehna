import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { ensureOrdersDraftColumn } from '@/shared/server/orders';

type CustomerSuggestionRow = {
  label: string | null;
};

export async function GET() {
  try {
    const pool = await getPool();
    await ensureOrdersDraftColumn();

    const result = await pool.query<CustomerSuggestionRow>(
      `
      select label
      from (
        select distinct
          coalesce(nullif(btrim(organization_name), ''), nullif(btrim(contact_name), '')) as label
        from orders
        where not (coalesce(is_draft, false) and coalesce(contact_name, '') = 'Osnutek')
      ) customers
      where label is not null
      order by lower(label)
      limit 250
      `
    );

    return NextResponse.json({
      customers: result.rows
        .map((row) => row.label?.trim())
        .filter((label): label is string => Boolean(label))
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.', customers: [] },
      { status: 500 }
    );
  }
}
