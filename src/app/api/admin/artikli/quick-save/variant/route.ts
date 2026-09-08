import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PATCH as handleAdminPATCH } from '@/admin/api/artikli/quick-save/variant/route';

export * from '@/admin/api/artikli/quick-save/variant/route';

export const PATCH = withAdminRoute(handleAdminPATCH);
