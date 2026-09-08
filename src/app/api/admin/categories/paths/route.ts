import { withAdminRoute } from '@/shared/auth/adminRoute';

import { GET as handleGetCategoryPaths } from '@/admin/api/categories/paths/route';

export const dynamic = 'force-dynamic';

async function handleAdminGET() {
  return handleGetCategoryPaths();
}

export const GET = withAdminRoute(handleAdminGET);
