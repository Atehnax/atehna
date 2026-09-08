import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/details/route';

export * from '@/admin/api/orders/[orderId]/details/route';

export const POST = withAdminRoute(handleAdminPOST);
