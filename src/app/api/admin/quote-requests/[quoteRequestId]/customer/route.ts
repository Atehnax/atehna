import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/quote-requests/[quoteRequestId]/customer/route';

export * from '@/admin/api/quote-requests/[quoteRequestId]/customer/route';

export const GET = withAdminRoute(handleAdminGET);
