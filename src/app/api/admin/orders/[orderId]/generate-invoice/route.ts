import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/generate-invoice/route';

export * from '@/admin/api/orders/[orderId]/generate-invoice/route';

export const POST = withAdminRoute(handleAdminPOST);
