import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PATCH as handleAdminPATCH } from '@/admin/api/pricing-stock/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminRoute(handleAdminGET);
export const PATCH = withAdminRoute(handleAdminPATCH);
