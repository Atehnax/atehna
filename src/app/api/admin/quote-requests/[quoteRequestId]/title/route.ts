import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PUT as handleAdminPUT } from '@/admin/api/quote-requests/[quoteRequestId]/title/route';

export const PUT = withAdminRoute(handleAdminPUT);
