import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/items/route';

export * from '@/admin/api/orders/[orderId]/items/route';

export const POST = withAdminRoute(handleAdminPOST);
