import { withAdminRoute } from '@/shared/auth/adminRoute';
import { DELETE as handleAdminDELETE } from '@/admin/api/orders/[orderId]/route';

export * from '@/admin/api/orders/[orderId]/route';

export const DELETE = withAdminRoute(handleAdminDELETE);
