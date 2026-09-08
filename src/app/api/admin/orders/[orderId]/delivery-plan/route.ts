import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/delivery-plan/route';

export * from '@/admin/api/orders/[orderId]/delivery-plan/route';

export const POST = withAdminRoute(handleAdminPOST);
