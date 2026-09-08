import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/orders/order-number-suggestions/route';

export * from '@/admin/api/orders/order-number-suggestions/route';

export const GET = withAdminRoute(handleAdminGET);
