import { processScheduledGeography } from '@/shared/server/geographyProcessing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  return processScheduledGeography(request);
}
