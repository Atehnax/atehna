import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/analytics/business/records/route';

export * from '@/admin/api/analytics/business/records/route';

export const GET = withAdminRoute(handleAdminGET);
