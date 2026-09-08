import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/quote-requests/[quoteRequestId]/withdraw/route';

export const POST = withAdminRoute(handleAdminPOST);
