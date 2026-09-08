import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST } from '@/admin/api/orders/[orderId]/documents/[documentId]/email/route';

export * from '@/admin/api/orders/[orderId]/documents/[documentId]/email/route';

export const POST = withAdminRoute(handleAdminPOST);
