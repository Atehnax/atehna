import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, DELETE as handleAdminDELETE } from '@/admin/api/orders/[orderId]/documents/[documentId]/route';

export * from '@/admin/api/orders/[orderId]/documents/[documentId]/route';

export const GET = withAdminRoute(handleAdminGET);
export const DELETE = withAdminRoute(handleAdminDELETE);
