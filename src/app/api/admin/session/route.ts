import { withAdminRoute } from '@/shared/auth/adminRoute';
import { getAdminSession } from '@/shared/auth/adminSession';
import { expiredAdminResponse } from '@/shared/auth/adminSettings';

export const GET = withAdminRoute(async (request: Request) => {
  const session = await getAdminSession(request);
  return session ? Response.json({ expiresAt: session.expiresAt.toISOString() }) : expiredAdminResponse();
});
