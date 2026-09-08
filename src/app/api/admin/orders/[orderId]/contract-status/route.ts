import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/contract-status/route';

export const POST = withAdminRoute(handleAdminPOST);
