import { POST as handlePostCategoryImage } from '@/admin/api/categories/images/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handlePostCategoryImage(request);
}
