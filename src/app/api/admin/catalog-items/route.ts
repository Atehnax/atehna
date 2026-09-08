import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/catalog-items/route';

export * from '@/admin/api/catalog-items/route';

export const GET = withAdminRoute(handleAdminGET);
