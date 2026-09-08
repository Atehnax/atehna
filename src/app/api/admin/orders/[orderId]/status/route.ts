import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/status/route';

export const maxDuration = 60;

export * from '@/admin/api/orders/[orderId]/status/route';

export const POST = withAdminRoute(handleAdminPOST);
