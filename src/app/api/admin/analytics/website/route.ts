import { withAdminRoute } from '@/shared/auth/adminRoute';

import { instrumentAdminRouteRender } from '@/shared/server/diagnostics/instrumentation';
import { handleWebsiteTrafficRequest } from '@/shared/server/websiteTrafficRequest';

export const dynamic = 'force-dynamic';
async function handleAdminGET(request: Request) {
  return instrumentAdminRouteRender('/api/admin/analytics/website', () => handleWebsiteTrafficRequest(request));
}

export const GET = withAdminRoute(handleAdminGET);
