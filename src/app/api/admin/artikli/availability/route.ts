import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/artikli/availability/route';

export * from '@/admin/api/artikli/availability/route';

export const GET = withAdminRoute(handleAdminGET);
