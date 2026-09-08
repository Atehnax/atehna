import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/orders/[orderId]/progress/route';

export * from '@/admin/api/orders/[orderId]/progress/route';

export const GET = withAdminRoute(handleAdminGET);
