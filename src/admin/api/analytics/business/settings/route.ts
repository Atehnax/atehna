import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { instrumentAdminRouteRender } from '@/shared/server/diagnostics/instrumentation';
import { BusinessSettingsInputError } from '@/shared/domain/analytics/businessSettings';
import { BusinessSettingsConflictError, fetchBusinessAnalyticsSettings, saveBusinessAnalyticsSettings } from '@/shared/server/businessAnalyticsSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(error: unknown) {
  if (error instanceof BusinessSettingsInputError) return Response.json({ message: error.message }, { status: 400, headers });
  if (error instanceof BusinessSettingsConflictError) return Response.json({ message: error.message, current: error.current }, { status: 409, headers });
  return Response.json({ message: 'Nastavitev analitike trenutno ni mogoče prebrati ali shraniti.' }, { status: 503, headers });
}
export async function GET(request: Request) {
  return instrumentAdminRouteRender('/api/admin/analytics/business/settings', async () => {
    if (!hasValidAdminSession(request)) return Response.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
    try { return Response.json(await fetchBusinessAnalyticsSettings(), { headers }); } catch (error) { return failure(error); }
  });
}
export async function PUT(request: Request) {
  return instrumentAdminRouteRender('/api/admin/analytics/business/settings', async () => {
    if (!hasValidAdminSession(request)) return Response.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
    if (request.headers.get('sec-fetch-site') === 'cross-site' || !requestOriginMatchesHost(request)) return Response.json({ message: 'Zahtevek mora izvirati iz te administracije.' }, { status: 403, headers });
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) { body.response.headers.set('Cache-Control', headers['Cache-Control']); return body.response; }
    try { return Response.json(await saveBusinessAnalyticsSettings(body.body, request), { headers }); } catch (error) { return failure(error); }
  });
}
