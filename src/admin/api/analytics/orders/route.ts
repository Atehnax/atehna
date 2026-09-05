import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { BUSINESS_PERIOD_PRESETS } from '@/shared/domain/analytics/period';
export const dynamic = 'force-dynamic';
/** Compatibility URL only: the retired business calculation no longer runs. */
export async function GET(request: Request) {
  if (!hasValidAdminSession(request)) return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  const target = new URL(request.url);
  target.pathname = '/api/admin/analytics/business';
  const requested = (target.searchParams.get('range') ?? '90D').toUpperCase();
  const range = requested === '365D' ? '1Y' : requested;
  target.searchParams.set('range', target.searchParams.has('from') && target.searchParams.has('to') ? 'custom' : (BUSINESS_PERIOD_PRESETS as readonly string[]).includes(range) ? range : '90D');
  target.searchParams.delete('grouping');
  return NextResponse.redirect(target, { status: 308, headers: { 'cache-control': 'private, no-store', 'x-atehna-analytics-replacement': 'canonical-business' } });
}
