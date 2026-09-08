import { withAdminRoute } from '@/shared/auth/adminRoute';

import {
  GET as handleGetCategoryImages,
  PATCH as handlePatchCategoryImages
} from '@/admin/api/categories/images/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleAdminGET(request: Request) {
  return handleGetCategoryImages(request);
}

async function handleAdminPATCH(request: Request) {
  return handlePatchCategoryImages(request);
}

export const GET = withAdminRoute(handleAdminGET);
export const PATCH = withAdminRoute(handleAdminPATCH);
