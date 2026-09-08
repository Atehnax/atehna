import { withAdminRoute } from '@/shared/auth/adminRoute';

import { GET as handleGetCategories, PATCH as handlePatchCategories, PUT as handlePutCategories } from '@/admin/api/categories/route';

export const dynamic = 'force-dynamic';

async function handleAdminGET(request: Request) {
  return handleGetCategories(request);
}

async function handleAdminPUT(request: Request) {
  return handlePutCategories(request);
}

async function handleAdminPATCH(request: Request) {
  return handlePatchCategories(request);
}

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
export const PATCH = withAdminRoute(handleAdminPATCH);
