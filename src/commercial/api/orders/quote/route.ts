import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  buildAuthoritativeOrderQuote,
  OrderCommerceError,
  parseOrderSelections
} from '@/shared/server/orderCommerce';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const pool = await getPool();
    const selections = await parseOrderSelections(pool, bodyResult.body.items);
    const quote = await buildAuthoritativeOrderQuote(pool, selections);

    return NextResponse.json(quote, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    if (error instanceof OrderCommerceError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          issues: error.issues
        },
        {
          status: error.status,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    console.error('[orders.quote] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'QUOTE_FAILED', message: 'Izračuna naročila trenutno ni mogoče pripraviti.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
