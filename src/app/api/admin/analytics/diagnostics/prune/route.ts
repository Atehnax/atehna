import { getPool } from '@/shared/server/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) return Response.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
  try {
    const pool = await getPool();
    const result = await pool.query("delete from diagnostics_events where recorded_at < now() - interval '7 days'");
    return Response.json({ removed: result.rowCount, retentionDays: 7 }, { headers: { 'cache-control': 'no-store' } });
  } catch { return Response.json({ message: 'Obrezovanje diagnostike ni uspelo.' }, { status: 503 }); }
}
