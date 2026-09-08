import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/analytics/business/activity/route';

export * from '@/admin/api/analytics/business/activity/route';

export const GET = withAdminRoute(handleAdminGET);
