import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/orders/customers/route';

export * from '@/admin/api/orders/customers/route';

export const GET = withAdminRoute(handleAdminGET);
