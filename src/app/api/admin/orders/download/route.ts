import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/orders/download/route';

export * from '@/admin/api/orders/download/route';

export const GET = withAdminRoute(handleAdminGET);
