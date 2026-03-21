import { GET as handleGetCategories, PATCH as handlePatchCategories, PUT as handlePutCategories } from '@/admin/api/categories/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleGetCategories(request);
}

export async function PUT(request: Request) {
  return handlePutCategories(request);
}

export async function PATCH(request: Request) {
  return handlePatchCategories(request);
}
