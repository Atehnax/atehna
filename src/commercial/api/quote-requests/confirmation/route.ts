import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';

export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};

export async function GET(request: NextRequest) {
  try {
    const pool = await getPool();
    const access = await verifyQuoteAccessSession(pool, request, {
      scope: 'request_confirmation'
    });
    if (!access) {
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Povpraševanje ni dostopno.' },
        { status: 404, headers: privateHeaders }
      );
    }
    const result = await pool.query(
      `
        select
          request.id,
          request.status,
          request.quote_reason,
          request.customer_message,
          request.customer_type,
          request.organization_name,
          request.contact_name,
          request.email,
          request.created_at,
          request.estimate_json,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'lineNumber', item.line_number,
                'sku', item.sku,
                'productName', item.product_name,
                'variantName', item.variant_name,
                'quantity', item.quantity,
                'unit', item.unit,
                'imageUrl', item.image_url
              )
              order by item.line_number
            ) filter (where item.id is not null),
            '[]'::jsonb
          ) as items
        from quote_requests request
        left join quote_request_items item on item.quote_request_id = request.id
        where request.id = $1
        group by request.id
      `,
      [access.quoteRequestId]
    );
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Povpraševanje ni dostopno.' },
        { status: 404, headers: privateHeaders }
      );
    }
    const estimate = row.estimate_json as Record<string, unknown>;
    return NextResponse.json(
      {
        status: row.status,
        quoteReason: row.quote_reason,
        customerMessage: row.customer_message,
        customer: {
          customerType: row.customer_type,
          organizationName: row.organization_name,
          contactName: row.contact_name,
          email: row.email
        },
        requestedAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        items: row.items,
        estimate: {
          totals: estimate?.totals ?? null,
          shipping: estimate?.shipping ?? null,
          isBinding: false
        }
      },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error('[quote.confirmation] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'QUOTE_CONFIRMATION_FAILED', message: 'Povpraševanja trenutno ni mogoče prikazati.' },
      { status: 500, headers: privateHeaders }
    );
  }
}
