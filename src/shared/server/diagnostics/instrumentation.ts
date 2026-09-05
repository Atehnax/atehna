import 'server-only';
import { after } from 'next/server';
import { getDatabaseUrl, getPool } from '@/shared/server/db';
import { createDiagnosticsInstrumentation } from './instrumentationCore';
import type { DiagnosticEvent } from '@/shared/domain/analytics/diagnostics';

let reportedFailureAt = 0;
async function persist(events: DiagnosticEvent[]) {
  if (!getDatabaseUrl()) return;
  try {
    const pool = await getPool();
    const query = {
      text: `insert into diagnostics_events (id, recorded_at, trace_id, context, operation, kind, duration_ms, payload_bytes, error, error_code, phases_json, details_json)
        select event_row.id, event_row.recorded_at, event_row.trace_id, event_row.context, event_row.operation, event_row.kind, event_row.duration_ms, event_row.payload_bytes, event_row.error, event_row.error_code, event_row.phases_json, event_row.details_json
        from jsonb_to_recordset($1::jsonb) as event_row(id uuid, recorded_at timestamptz, trace_id uuid, context text, operation text, kind text, duration_ms double precision, payload_bytes bigint, error boolean, error_code text, phases_json jsonb, details_json jsonb)
        on conflict (id) do nothing`,
      values: [JSON.stringify(events.map(event => ({ id: event.id, recorded_at: event.recordedAt, trace_id: event.traceId, context: event.context, operation: event.operation, kind: event.kind, duration_ms: event.durationMs, payload_bytes: event.payloadBytes, error: event.error, error_code: event.errorCode, phases_json: event.phases, details_json: event.details })))],
      query_timeout: 1000
    };
    await pool.query(query);
  } catch {
    if (Date.now() - reportedFailureAt > 60000) { console.error('Diagnostics persistence unavailable; check database connectivity and current schema.'); reportedFailureAt = Date.now(); }
  }
}
const globalState = globalThis as typeof globalThis & { atehnaDiagnostics?: ReturnType<typeof createDiagnosticsInstrumentation> };
const instrumentation = globalState.atehnaDiagnostics ??= createDiagnosticsInstrumentation(persist, task => {
  // Next keeps this work alive after actions whose cache invalidations have no enclosing trace.
  try { after(task); } catch { void task(); }
});
export const { instrumentAdminRouteRender, instrumentCatalogLoader, instrumentCatalogCacheMiss, profileRoutePhase, profilePayloadEstimate, recordCatalogInvalidation } = instrumentation;
