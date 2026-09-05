import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { BusinessAnalyticsInputError, fetchBusinessAnalytics } from '@/shared/server/businessAnalytics';
import { isDatabaseUnavailableError } from '@/shared/server/db';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!hasValidAdminSession(request)) return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  try { return NextResponse.json(await fetchBusinessAnalytics(new URL(request.url).searchParams), { headers: { 'cache-control': 'private, no-store' } }); }
  catch (error) { console.error('Business analytics unavailable', error); const input = error instanceof BusinessAnalyticsInputError || error instanceof Error && /datum|obdobje/i.test(error.message); return NextResponse.json({ message: input && error instanceof Error ? error.message : 'Poslovna analitika ni na voljo. Preverite povezavo in podatkovno migracijo.' }, { status: input ? 400 : isDatabaseUnavailableError(error) ? 503 : 500 }); }
}
