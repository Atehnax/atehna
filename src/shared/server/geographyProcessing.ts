export const GEOGRAPHY_DAILY_BATCH_SIZE = 100;

type BatchOptions = { batchSize: number; retryUnresolved: boolean };
type BatchResult = { status: string; processed: number; remaining?: boolean; version?: string };
type ProcessingDependencies = {
  cronSecret?: string;
  processBatch?: (options: BatchOptions) => Promise<BatchResult>;
};

export async function processScheduledGeography(request: Request, dependencies: ProcessingDependencies = {}) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') return Response.json({ message: 'Metoda ni dovoljena.' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  const secret = dependencies.cronSecret ?? process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ message: 'Nedovoljen dostop.' }, { status: 401, headers });
  }
  try {
    const processBatch = dependencies.processBatch ?? (await import('@/shared/server/geographyAnalytics')).backfillGeography;
    // One bounded pass only. The existing lease/cursor handles concurrency and
    // resumption. This uses locally imported references and makes no GURS call.
    const result = await processBatch({ batchSize: GEOGRAPHY_DAILY_BATCH_SIZE, retryUnresolved: true });
    return Response.json(result, { headers });
  } catch (error) {
    console.error('Scheduled geography processing failed', error);
    return Response.json({ message: 'Paketni pripis geografije ni uspel; obstoječe preslikave so ohranjene.' }, { status: 503, headers });
  }
}
