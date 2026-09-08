import { withAdminRoute } from '@/shared/auth/adminRoute';
import { PATCH as handleAdminPATCH } from '@/admin/api/product-appearance/products/[slug]/route';

export * from '@/admin/api/product-appearance/products/[slug]/route';

export const PATCH = withAdminRoute(handleAdminPATCH);
