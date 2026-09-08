import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/generate-order-summary/route';

export * from '@/admin/api/orders/[orderId]/generate-order-summary/route';

export const POST = withAdminRoute(handleAdminPOST);
