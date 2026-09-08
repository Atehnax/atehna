import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PUT as handleAdminPUT } from '@/admin/api/quote-requests/[quoteRequestId]/details/route';
import { PATCH as handleAdminPATCH } from '@/admin/api/quote-requests/[quoteRequestId]/details/route';

export const PUT = withAdminRoute(handleAdminPUT);
export const PATCH = withAdminRoute(handleAdminPATCH);
