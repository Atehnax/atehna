import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/artikli/activate/route';

export * from '@/admin/api/artikli/activate/route';
export const POST = withAdminRoute(handleAdminPOST);
