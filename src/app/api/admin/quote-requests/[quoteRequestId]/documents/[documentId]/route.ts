import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/quote-requests/[quoteRequestId]/documents/[documentId]/route';

export const GET = withAdminRoute(handleAdminGET);
