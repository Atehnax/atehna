import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, POST as handleAdminPOST } from '@/admin/api/analytics/orders/[orderId]/measurements/route';

export const runtime = 'nodejs';

export const GET = withAdminRoute(handleAdminGET);
export const POST = withAdminRoute(handleAdminPOST);
