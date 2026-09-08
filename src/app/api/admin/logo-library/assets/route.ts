import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/logo-library/assets/route';

export * from '@/admin/api/logo-library/assets/route';

export const POST = withAdminRoute(handleAdminPOST);
