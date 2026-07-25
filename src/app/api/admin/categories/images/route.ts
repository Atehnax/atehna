import {
  GET as handleGetCategoryImages,
  PATCH as handlePatchCategoryImages,
  POST as handlePostCategoryImage
} from '@/admin/api/categories/images/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleGetCategoryImages(request);
}

export async function POST(request: Request) {
  return handlePostCategoryImage(request);
}

export async function PATCH(request: Request) {
  return handlePatchCategoryImages(request);
}
