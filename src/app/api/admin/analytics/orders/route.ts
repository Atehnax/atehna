import { NextResponse } from 'next/server';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/lib/server/orderAnalytics';
import { getDatabaseUrl } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateParam = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return DATE_PARAM_PATTERN.test(trimmed) ? trimmed : null;
};

const normalizeRange = (value: string | null) => {
  if (value === '30d' || value === '90d' || value === '180d' || value === '365d') return value;
  return '90d';
};

const normalizeGrouping = (value: string | null) => (value === 'day' ? 'day' : 'day');

export async function GET(request: Request) {
  try {
    if (!getDatabaseUrl()) {
      return NextResponse.json(emptyOrdersAnalyticsResponse());
    }

    const url = new URL(request.url);
    const range = normalizeRange(url.searchParams.get('range'));
    const from = normalizeDateParam(url.searchParams.get('from'));
    const to = normalizeDateParam(url.searchParams.get('to'));
    const grouping = normalizeGrouping(url.searchParams.get('grouping'));

    const analytics = await fetchOrdersAnalytics({ range, from, to, grouping });
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to load admin orders analytics', error);
    return NextResponse.json(
      { message: 'Analitika trenutno ni na voljo.' },
      { status: 500 }
    );
  }
}
