import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PATCH as handleAdminPATCH } from '@/admin/api/artikli/quick-save/item/route';

export * from '@/admin/api/artikli/quick-save/item/route';

export const PATCH = withAdminRoute(handleAdminPATCH);
