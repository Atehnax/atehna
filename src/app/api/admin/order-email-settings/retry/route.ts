import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/order-email-settings/retry/route';

export * from '@/admin/api/order-email-settings/retry/route';

export const POST = withAdminRoute(handleAdminPOST);
