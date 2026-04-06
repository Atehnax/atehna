import { GET as handleGetCategoryPaths } from '@/admin/api/categories/paths/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleGetCategoryPaths();
}
