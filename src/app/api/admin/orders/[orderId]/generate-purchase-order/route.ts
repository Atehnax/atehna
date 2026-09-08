import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/generate-purchase-order/route';

export * from '@/admin/api/orders/[orderId]/generate-purchase-order/route';

export const POST = withAdminRoute(handleAdminPOST);
