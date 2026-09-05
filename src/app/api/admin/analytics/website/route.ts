import { instrumentAdminRouteRender } from '@/shared/server/diagnostics/instrumentation';
import { handleWebsiteTrafficRequest } from '@/shared/server/websiteTrafficRequest';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return instrumentAdminRouteRender('/api/admin/analytics/website', () => handleWebsiteTrafficRequest(request));
}
