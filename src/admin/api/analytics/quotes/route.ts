import { NextResponse } from 'next/server';
import {
  emptyQuoteAnalyticsResponse,
  type QuoteAnalyticsRange
} from '@/shared/domain/quote/quoteAnalytics';
import { getDatabaseUrl } from '@/shared/server/db';
import {
  fetchQuoteAnalytics,
  normalizeQuoteAnalyticsRange
} from '@/shared/server/quoteAnalytics';

export const dynamic = 'force-dynamic';

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateParam = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return DATE_PARAM_PATTERN.test(trimmed) ? trimmed : null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = normalizeQuoteAnalyticsRange(url.searchParams.get('range'));

  try {
    if (!getDatabaseUrl()) {
      return NextResponse.json(emptyQuoteAnalyticsResponse(range as QuoteAnalyticsRange));
    }

    const analytics = await fetchQuoteAnalytics({
      range,
      from: normalizeDateParam(url.searchParams.get('from')),
      to: normalizeDateParam(url.searchParams.get('to'))
    });
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to load admin quote analytics', error);
    return NextResponse.json(
      { message: 'Analitika povpraševanj in ponudb trenutno ni na voljo.' },
      { status: 500 }
    );
  }
}
