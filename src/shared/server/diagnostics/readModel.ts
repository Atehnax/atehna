import 'server-only';
import { getPool } from '@/shared/server/db';
import { resolveDiagnosticFilters, type DiagnosticEvent, type DiagnosticsResponse } from '@/shared/domain/analytics/diagnostics';

const numberOrNull = (value: unknown) => value == null ? null : Number(value);
const iso = (value: unknown) => new Date(value as string | number | Date).toISOString();
export async function fetchDiagnostics(params: URLSearchParams): Promise<DiagnosticsResponse> {
  const filters = resolveDiagnosticFilters(params);
  const pool = await getPool(), client = await pool.connect();
  const values = [filters.start, filters.asOf, filters.context, filters.kind, filters.errorsOnly, filters.traceId];
  const population = `from diagnostics_events where recorded_at >= $1::timestamptz and recorded_at <= $2::timestamptz
    and ($3::text = '' or context = $3) and ($4::text = 'all' or kind = $4)
    and (not $5::boolean or error) and ($6::uuid is null or trace_id = $6)`;
  try {
    await client.query('begin isolation level repeatable read read only');
    const coverageResult = await client.query('select min(recorded_at) as first_recorded_at, count(*) as total from diagnostics_events where recorded_at <= $1::timestamptz', [filters.asOf]);
    const coverage = coverageResult.rows[0];
    const summaryResult = await client.query(`select count(*) as observations, count(*) filter (where kind = 'route') as routes, count(*) filter (where kind = 'loader') as loaders,
      count(*) filter (where kind = 'cache_miss') as cache_executions, count(*) filter (where kind = 'invalidation') as invalidations,
      count(*) filter (where error) as errors, avg(duration_ms) as mean_ms, percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
      coalesce(sum(payload_bytes), 0) as payload_bytes, count(payload_bytes) as payload_measured ` + population, values);
    const groups = await client.query(`select context, operation, kind, count(*) as count, count(*) filter (where error) as errors,
      avg(duration_ms) as mean_ms, percentile_cont(0.95) within group (order by duration_ms) as p95_ms, max(duration_ms) as max_ms,
      coalesce(sum(payload_bytes), 0) as payload_bytes, count(payload_bytes) as payload_measured,
      avg((phases_json ->> 'db')::double precision) as db_ms, avg((phases_json ->> 'cache')::double precision) as cache_ms,
      avg((phases_json ->> 'transform')::double precision) as transform_ms, max(recorded_at) as last_seen ` + population + ' group by context, operation, kind order by errors desc, p95_ms desc nulls last, context, operation', values);
    const bucketResult = await client.query(`select date_bin(make_interval(mins => $7::int), recorded_at, '2000-01-01'::timestamptz) as timestamp,
      count(*) as observations, count(*) filter (where error) as errors, avg(duration_ms) as mean_ms,
      percentile_cont(0.95) within group (order by duration_ms) as p95_ms, sum(payload_bytes) as payload_bytes ` + population + ' group by timestamp order by timestamp', [...values, filters.bucketMinutes]);
    const recentResult = await client.query('select * ' + population + ' order by recorded_at desc, id limit $7', [...values, filters.traceId ? 501 : 50]);
    const contexts = await client.query('select distinct context from diagnostics_events where recorded_at >= $1::timestamptz and recorded_at <= $2::timestamptz order by context', [filters.start, filters.asOf]);
    await client.query('commit');
    const summary = summaryResult.rows[0], firstRecordedAt = coverage.first_recorded_at ? iso(coverage.first_recorded_at) : null;
    const bucketMs = filters.bucketMinutes * 60000;
    const buckets = new Map(bucketResult.rows.map(row => [iso(row.timestamp), row]));
    const series: DiagnosticsResponse['series'] = [];
    for (let timestamp = Math.floor(Date.parse(filters.start) / bucketMs) * bucketMs; timestamp <= Date.parse(filters.asOf); timestamp += bucketMs) {
      const key = new Date(timestamp).toISOString(), row = buckets.get(key);
      const known = firstRecordedAt != null && timestamp + bucketMs > Date.parse(firstRecordedAt);
      series.push({ timestamp: key, observations: row ? Number(row.observations) : known ? 0 : null, errors: row ? Number(row.errors) : known ? 0 : null, meanMs: row ? numberOrNull(row.mean_ms) : null, p95Ms: row ? numberOrNull(row.p95_ms) : null, payloadBytes: row ? numberOrNull(row.payload_bytes) : null });
    }
    return {
      asOf: filters.asOf, filters,
      coverage: { firstRecordedAt, retainedFrom: new Date(Date.now() - 7 * 86400000).toISOString(), completeWindow: firstRecordedAt != null && firstRecordedAt <= filters.start, retentionDays: 7, totalStored: Number(coverage.total), traceLimited: recentResult.rows.length > 500 },
      summary: { observations: Number(summary.observations), routes: Number(summary.routes), loaders: Number(summary.loaders), cacheExecutions: Number(summary.cache_executions), invalidations: Number(summary.invalidations), errors: Number(summary.errors), errorRate: Number(summary.observations) ? Number(summary.errors) / Number(summary.observations) : null, meanMs: numberOrNull(summary.mean_ms), p95Ms: numberOrNull(summary.p95_ms), payloadBytes: Number(summary.payload_bytes), payloadMeasured: Number(summary.payload_measured) },
      series, contexts: contexts.rows.map(row => String(row.context)),
      groups: groups.rows.map(row => ({ context: row.context, operation: row.operation, kind: row.kind, count: Number(row.count), errors: Number(row.errors), meanMs: numberOrNull(row.mean_ms), p95Ms: numberOrNull(row.p95_ms), maxMs: numberOrNull(row.max_ms), payloadBytes: Number(row.payload_bytes), payloadMeasured: Number(row.payload_measured), dbMs: numberOrNull(row.db_ms), cacheMs: numberOrNull(row.cache_ms), transformMs: numberOrNull(row.transform_ms), lastSeen: iso(row.last_seen) })),
      recent: recentResult.rows.slice(0, 500).map(row => ({ id: row.id, recordedAt: iso(row.recorded_at), traceId: row.trace_id, context: row.context, operation: row.operation, kind: row.kind as DiagnosticEvent['kind'], durationMs: numberOrNull(row.duration_ms), payloadBytes: numberOrNull(row.payload_bytes), error: row.error, errorCode: row.error_code, phases: row.phases_json, details: row.details_json }))
    };
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
