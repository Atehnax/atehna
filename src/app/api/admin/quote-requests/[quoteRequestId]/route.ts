import { withAdminRoute } from '@/shared/auth/adminRoute';
import { DELETE as handleAdminDELETE } from '@/admin/api/quote-requests/[quoteRequestId]/route';

export const DELETE = withAdminRoute(handleAdminDELETE);
