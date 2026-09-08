import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PUT as handleAdminPUT } from '@/admin/api/pricing-stock/model/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withAdminRoute(handleAdminPUT);
