import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PUT as handleAdminPUT } from '@/admin/api/inventory-policy/route';

export const dynamic = 'force-dynamic';

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
