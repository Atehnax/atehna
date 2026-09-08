import { withAdminRoute } from '@/shared/auth/adminRoute';

import { processScheduledGeography } from '@/shared/server/geographyProcessing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handleAdminGET(request: Request) {
  return processScheduledGeography(request);
}

export const GET = withAdminRoute(handleAdminGET, { allowCron: true });
