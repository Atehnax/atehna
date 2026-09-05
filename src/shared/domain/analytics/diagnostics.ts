export const DIAGNOSTIC_WINDOWS = { '5m': 5, '15m': 15, '60m': 60, '6h': 360, '24h': 1440, '7d': 10080 } as const;
export type DiagnosticKind = 'route' | 'loader' | 'cache_miss' | 'invalidation';
export type DiagnosticEvent = {
  id: string; recordedAt: string; traceId: string; context: string; operation: string; kind: DiagnosticKind;
  durationMs: number | null; payloadBytes: number | null; error: boolean; errorCode: string | null;
  phases: Record<string, number>; details: Record<string, unknown>;
};
export class DiagnosticsInputError extends Error {}
export function resolveDiagnosticFilters(params: URLSearchParams, now = new Date()) {
  const window = params.get('window') ?? '15m';
  if (!Object.hasOwn(DIAGNOSTIC_WINDOWS, window)) throw new DiagnosticsInputError('Izberite veljavno časovno okno.');
  const asOf = params.has('asOf') ? new Date(params.get('asOf')!) : now;
  if (!Number.isFinite(asOf.getTime()) || asOf > now || asOf.getTime() < now.getTime() - 7 * 86400000) throw new DiagnosticsInputError('Čas posnetka mora biti v zadnjih sedmih dneh.');
  const minutes = DIAGNOSTIC_WINDOWS[window as keyof typeof DIAGNOSTIC_WINDOWS];
  const kind = params.get('kind') ?? 'all';
  if (!['all', 'route', 'loader', 'cache_miss', 'invalidation'].includes(kind)) throw new DiagnosticsInputError('Neveljavna vrsta meritve.');
  const context = params.get('context') ?? '';
  if (context.length > 180) throw new DiagnosticsInputError('Kontekst je predolg.');
  const traceId = params.get('traceId');
  if (traceId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(traceId)) throw new DiagnosticsInputError('Neveljaven ID sledi.');
  return { window, minutes, asOf: asOf.toISOString(), start: new Date(asOf.getTime() - minutes * 60000).toISOString(), bucketMinutes: minutes <= 60 ? 1 : minutes <= 360 ? 5 : minutes <= 1440 ? 15 : 60, kind, context, errorsOnly: params.get('errors') === 'true', traceId };
}
export type DiagnosticFilters = ReturnType<typeof resolveDiagnosticFilters>;
export type DiagnosticGroup = { context: string; operation: string; kind: string; count: number; errors: number; meanMs: number | null; p95Ms: number | null; maxMs: number | null; payloadBytes: number; payloadMeasured: number; dbMs: number | null; cacheMs: number | null; transformMs: number | null; lastSeen: string };
export type DiagnosticsResponse = {
  asOf: string; filters: DiagnosticFilters;
  coverage: { firstRecordedAt: string | null; retainedFrom: string; completeWindow: boolean; retentionDays: number; totalStored: number; traceLimited: boolean };
  summary: { observations: number; routes: number; loaders: number; cacheExecutions: number; invalidations: number; errors: number; errorRate: number | null; meanMs: number | null; p95Ms: number | null; payloadBytes: number; payloadMeasured: number };
  series: { timestamp: string; observations: number | null; errors: number | null; meanMs: number | null; p95Ms: number | null; payloadBytes: number | null }[];
  groups: DiagnosticGroup[]; recent: DiagnosticEvent[]; contexts: string[];
};
export function diagnosticsCsv(data: DiagnosticsResponse) {
  const rows = [['Kontekst', 'Operacija', 'Vrsta', 'Meritve', 'Napake', 'Povprečje ms', 'p95 ms', 'Maksimum ms', 'Merjen prenos B', 'Meritve prenosa', 'DB povprečje ms', 'Predpomnilnik povprečje ms', 'Obdelava povprečje ms', 'Nazadnje UTC'], ...data.groups.map(row => [row.context, row.operation, row.kind, row.count, row.errors, row.meanMs, row.p95Ms, row.maxMs, row.payloadBytes, row.payloadMeasured, row.dbMs, row.cacheMs, row.transformMs, row.lastSeen])];
  return '\ufeff' + rows.map(row => row.map(value => {
    const text = value == null ? '' : String(value);
    return '"' + (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  }).join(';')).join('\r\n');
}
