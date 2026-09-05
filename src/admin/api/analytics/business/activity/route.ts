import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { BusinessActivityInputError } from '@/shared/domain/analytics/activity';
import { fetchBusinessActivity } from '@/shared/server/businessAnalytics';
import { instrumentAdminRouteRender, profilePayloadEstimate } from '@/shared/server/diagnostics/instrumentation';

export const dynamic = 'force-dynamic';
const headers = { 'cache-control': 'private, no-store' };

async function handleGet(request: Request) {
  if (!hasValidAdminSession(request)) return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
  try {
    const data = await fetchBusinessActivity(new URL(request.url).searchParams);
    profilePayloadEstimate('business-activity', data);
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof BusinessActivityInputError) return NextResponse.json({ message: error.message }, { status: 400, headers });
    console.error('Business activity unavailable', error);
    return NextResponse.json({ message: 'Aktivnost naročil trenutno ni na voljo. Poskusite znova.' }, { status: 503, headers });
  }
}

export async function GET(request: Request) {
  return instrumentAdminRouteRender('/api/admin/analytics/business/activity', () => handleGet(request));
}
