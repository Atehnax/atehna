import { withAdminRoute } from '@/shared/auth/adminRoute';
import { DELETE as handleAdminDELETE } from '@/admin/api/quote-email-jobs/[jobId]/route';

export const DELETE = withAdminRoute(handleAdminDELETE);
