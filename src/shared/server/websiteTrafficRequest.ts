import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { WebsiteTrafficInputError, WEBSITE_EXPORTS, websiteCsv, websitePeriod, type WebsiteExport, type WebsiteTraffic } from '@/shared/domain/analytics/websiteTraffic';

const defaultLoad = async (params: URLSearchParams) => (await import('./websiteTraffic')).fetchWebsiteTraffic(params);
const headers = { 'cache-control': 'private, no-store' };
export async function handleWebsiteTrafficRequest(request: Request, load: (params: URLSearchParams) => Promise<WebsiteTraffic> = defaultLoad) {
  if (!hasValidAdminSession(request)) return Response.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    const kind = params.get('export');
    if (kind !== null && !(WEBSITE_EXPORTS as readonly string[]).includes(kind)) throw new WebsiteTrafficInputError('Neveljaven izvoz.');
    const { asOf } = websitePeriod(params);
    params.set('asOf', asOf.toISOString());
    const data = await load(params);
    if (kind) return new Response(websiteCsv(data, kind as WebsiteExport), { headers: { ...headers, 'content-type': 'text/csv;charset=utf-8', 'content-disposition': `attachment; filename="splet-${kind}-${data.period.from}-${data.period.to}.csv"` } });
    return Response.json(data, { headers });
  } catch (error) {
    const input = error instanceof WebsiteTrafficInputError;
    if (!input) console.error('Website traffic unavailable', error);
    return Response.json({ message: input ? error.message : 'Spletna analitika ni na voljo. Podatkov ni bilo mogoče prebrati; poskusite znova.' }, { status: input ? 400 : 503, headers });
  }
}
