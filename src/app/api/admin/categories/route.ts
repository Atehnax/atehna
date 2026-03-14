import { GET as handleGetCategories, PUT as handlePutCategories } from '@/admin/api/categories/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleGetCategories();
}

export async function PUT(request: Request) {
  return handlePutCategories(request);
}
