import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/artikli/route';

export * from '@/admin/api/artikli/route';

export const POST = withAdminRoute(handleAdminPOST);
