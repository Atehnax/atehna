import { withAdminRoute } from '@/shared/auth/adminRoute';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';
import { recordAdminActivity } from '@/shared/auth/adminSettings';

export const POST = withAdminRoute(async (request: Request) => {
  const forged = rejectAdminCrossOrigin(request, { requireOrigin: true });
  if (forged) return forged;
  if (request.headers.get('x-admin-activity') !== '1') {
    return Response.json({ error: 'Zahteva ni dovoljena.' }, { status: 403 });
  }
  return recordAdminActivity(request);
});
