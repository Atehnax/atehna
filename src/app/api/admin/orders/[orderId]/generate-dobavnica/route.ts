import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/generate-dobavnica/route';

export * from '@/admin/api/orders/[orderId]/generate-dobavnica/route';

export const POST = withAdminRoute(handleAdminPOST);
