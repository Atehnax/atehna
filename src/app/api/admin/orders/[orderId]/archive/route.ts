import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PATCH as handleAdminPATCH } from '@/admin/api/orders/[orderId]/archive/route';

export const PATCH = withAdminRoute(handleAdminPATCH);
