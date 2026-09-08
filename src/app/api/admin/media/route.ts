import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/media/route';

export * from '@/admin/api/media/route';

export const POST = withAdminRoute(handleAdminPOST);
