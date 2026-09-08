import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PUT as handleAdminPUT } from '@/admin/api/order-document-templates/route';

export * from '@/admin/api/order-document-templates/route';

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
