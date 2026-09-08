import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/analytics/business/route';

export * from '@/admin/api/analytics/business/route';

export const GET = withAdminRoute(handleAdminGET);
