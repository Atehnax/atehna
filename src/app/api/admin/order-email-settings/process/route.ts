import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/order-email-settings/process/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withAdminRoute(handleAdminGET, { allowCron: true });
