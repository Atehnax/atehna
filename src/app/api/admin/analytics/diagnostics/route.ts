import { withAdminRoute } from '@/shared/auth/adminRoute';

import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { diagnosticsCsv, DiagnosticsInputError } from '@/shared/domain/analytics/diagnostics';
import { getRuntimeTimingMetadata } from '@/shared/server/diagnostics/runtimeTiming';
import { fetchDiagnostics } from '@/shared/server/diagnostics/readModel';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handleAdminGET(request: Request) {
  const headers = { 'cache-control': 'private, no-store' };
  if (!await hasValidAdminSession(request)) return Response.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('runtime') === '1') return Response.json(getRuntimeTimingMetadata(), { headers });
    const data = await fetchDiagnostics(params);
    return params.get('format') === 'csv'
      ? new Response(diagnosticsCsv(data), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="atehna-diagnostika.csv"' } })
      : Response.json(data, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof DiagnosticsInputError ? error.message : 'Diagnostika ni dosegljiva. Preverite povezavo z bazo in namestitev trenutne podatkovne sheme.' }, { status: error instanceof DiagnosticsInputError ? 400 : 503, headers });
  }
}

export const GET = withAdminRoute(handleAdminGET);
