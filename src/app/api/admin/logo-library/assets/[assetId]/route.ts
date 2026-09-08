import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/logo-library/assets/[assetId]/route';

export * from '@/admin/api/logo-library/assets/[assetId]/route';

export const GET = withAdminRoute(handleAdminGET);
