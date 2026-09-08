import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/payment-status/route';

export * from '@/admin/api/orders/[orderId]/payment-status/route';

export const POST = withAdminRoute(handleAdminPOST);
