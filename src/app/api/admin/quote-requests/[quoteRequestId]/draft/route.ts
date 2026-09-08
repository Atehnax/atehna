import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PUT as handleAdminPUT } from '@/admin/api/quote-requests/[quoteRequestId]/draft/route';

export const PUT = withAdminRoute(handleAdminPUT);
