import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, POST as handleAdminPOST } from '@/admin/api/addresses/sync/route';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const GET = withAdminRoute(handleAdminGET, { allowCron: true });
export const POST = withAdminRoute(handleAdminPOST);
