import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/artikli/archived/route';

export * from '@/admin/api/artikli/archived/route';

export const GET = withAdminRoute(handleAdminGET);
