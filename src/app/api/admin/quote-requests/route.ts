import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/quote-requests/route';

export const POST = withAdminRoute(handleAdminPOST);
