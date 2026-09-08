import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/order-document-templates/preview/route';

export * from '@/admin/api/order-document-templates/preview/route';

export const POST = withAdminRoute(handleAdminPOST);
