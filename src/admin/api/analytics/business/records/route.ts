import { instrumentAdminRouteRender, profilePayloadEstimate } from '@/shared/server/diagnostics/instrumentation';
import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { businessRecordsCsv, BusinessAnalyticsInputError, fetchBusinessRecords } from '@/shared/server/businessAnalytics';
import { isDatabaseUnavailableError } from '@/shared/server/db';
export const dynamic = 'force-dynamic';
async function handleGet(request: Request) {
  if (!hasValidAdminSession(request)) return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  try { const params = new URL(request.url).searchParams; const csv = params.get('format') === 'csv'; const data = await fetchBusinessRecords(params, csv); profilePayloadEstimate('business-records', data); return csv ? new Response(businessRecordsCsv(data.records), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="atehna-poslovna-analitika.csv"', 'cache-control': 'private, no-store' } }) : NextResponse.json(data, { headers: { 'cache-control': 'private, no-store' } }); }
  catch (error) { console.error('Business analytics records unavailable', error); return NextResponse.json({ message: error instanceof BusinessAnalyticsInputError ? error.message : 'Zapisov trenutno ni mogoče pridobiti.' }, { status: error instanceof BusinessAnalyticsInputError ? 400 : isDatabaseUnavailableError(error) ? 503 : 500 }); }
}

export async function GET(request: Request) { return instrumentAdminRouteRender('/api/admin/analytics/business/records', () => handleGet(request)); }
