import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/quote-email-jobs/[jobId]/retry/route';

export const POST = withAdminRoute(handleAdminPOST);
