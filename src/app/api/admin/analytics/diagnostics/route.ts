import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { diagnosticsCsv, DiagnosticsInputError } from '@/shared/domain/analytics/diagnostics';
import { fetchDiagnostics } from '@/shared/server/diagnostics/readModel';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'cache-control': 'private, no-store' };
  if (!hasValidAdminSession(request)) return Response.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    const data = await fetchDiagnostics(params);
    return params.get('format') === 'csv'
      ? new Response(diagnosticsCsv(data), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="atehna-diagnostika.csv"' } })
      : Response.json(data, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof DiagnosticsInputError ? error.message : 'Diagnostika ni dosegljiva. Preverite povezavo z bazo in namestitev trenutne podatkovne sheme.' }, { status: error instanceof DiagnosticsInputError ? 400 : 503, headers });
  }
}
