import { withAdminRoute } from '@/shared/auth/adminRoute';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';
import { changeAdminSessionPolicy } from '@/shared/auth/adminSettings';
import { getAdminSessionPolicy } from '@/shared/auth/adminSession';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { NextResponse } from 'next/server';

export const GET = withAdminRoute(async () => NextResponse.json(await getAdminSessionPolicy()));
export const POST = withAdminRoute(async (request: Request) => {
  const forged = rejectAdminCrossOrigin(request, { requireOrigin: true });
  if (forged) return forged;
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  try {
    return await changeAdminSessionPolicy(request, parsed.body);
  } catch {
    return NextResponse.json({ error: 'Nastavitev ni bilo mogoče shraniti. Poskusite znova.' }, { status: 503 });
  }
});
