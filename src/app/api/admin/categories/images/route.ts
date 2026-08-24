import {
  GET as handleGetCategoryImages,
  PATCH as handlePatchCategoryImages
} from '@/admin/api/categories/images/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleGetCategoryImages(request);
}

export async function PATCH(request: Request) {
  return handlePatchCategoryImages(request);
}
