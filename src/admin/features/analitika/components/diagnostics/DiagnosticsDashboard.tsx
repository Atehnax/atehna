'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DIAGNOSTIC_WINDOWS, type DiagnosticsResponse, type DiagnosticEvent } from '@/shared/domain/analytics/diagnostics';
import BusinessChart, { DataTable, numeric, percent } from '../business/BusinessChart';

const control = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700';
const labels: Record<string, string> = { route: 'Zahteve', loader: 'Branje podatkov', cache_miss: 'Izvedbe brez zadetka predpomnilnika', invalidation: 'Razveljavitve predpomnilnika' };
const windows: Record<string, string> = { '5m': '5 min', '15m': '15 min', '60m': '1 ura', '6h': '6 ur', '24h': '24 ur', '7d': '7 dni' };
const dateLabel = (value: string) => new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const bytes = (value: number | null) => value == null ? 'Ni izmerjeno' : value >= 1048576 ? numeric(value / 1048576) + ' MB' : value >= 1024 ? numeric(value / 1024) + ' kB' : numeric(value, 0) + ' B';

export default function DiagnosticsDashboard() {
  const search = useSearchParams(), router = useRouter(), query = search.toString();
  const [data, setData] = useState<DiagnosticsResponse | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [automatic, setAutomatic] = useState(false);
  const [context, setContext] = useState(search.get('context') ?? '');
  const [traceId, setTraceId] = useState<string | null>(null), [trace, setTrace] = useState<DiagnosticsResponse | null>(null), [traceError, setTraceError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(query); params.delete('asOf'); params.delete('traceId');
    Object.entries(changes).forEach(([key, value]) => value == null || value === '' ? params.delete(key) : params.set(key, value));
    router.replace('/admin/analitika/diagnostika?' + params.toString(), { scroll: false });
  };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    fetch('/api/admin/analytics/diagnostics?' + query, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message); return payload as DiagnosticsResponse; })
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(error => { if (error.name !== 'AbortError') { setError(error.message); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision]);
  useEffect(() => {
    if (!automatic) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') setRevision(value => value + 1); }, 15000);
    return () => clearInterval(timer);
  }, [automatic]);
  useEffect(() => {
    if (!traceId || !data) return;
    dialog.current?.showModal(); setTrace(null); setTraceError('');
    const controller = new AbortController();
    const params = new URLSearchParams({ window: data.filters.window, asOf: data.asOf, traceId });
    fetch('/api/admin/analytics/diagnostics?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message); return payload as DiagnosticsResponse; })
      .then(payload => { if (!controller.signal.aborted) setTrace(payload); }).catch(error => { if (error.name !== 'AbortError') setTraceError(error.message); });
    return () => controller.abort();
  }, [traceId, data]);
  const exportParams = new URLSearchParams(query); if (data) exportParams.set('asOf', data.asOf); exportParams.set('format', 'csv');
  const chartDateLabel = (value: string) => new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', ...(data && data.filters.minutes > 1440 ? { day: '2-digit', month: '2-digit' } as const : { hour: '2-digit', minute: '2-digit' } as const) }).format(new Date(value));
  const ticks = data?.series.filter((_, index) => index % Math.max(1, Math.ceil(data.series.length / 6)) === 0) ?? [];
  const tableEvents = (rows: DiagnosticEvent[]) => rows.map(event => ({ values: [event.operation, event.context, labels[event.kind], dateLabel(event.recordedAt), event.durationMs, event.errorCode ?? 'Brez napake', bytes(event.payloadBytes)] }));

  return <div className="space-y-4">
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1" aria-label="Diagnostično časovno okno">
        {Object.keys(DIAGNOSTIC_WINDOWS).map(window => <button key={window} type="button" aria-pressed={(search.get('window') ?? '15m') === window} onClick={() => update({ window })} className={control + ((search.get('window') ?? '15m') === window ? ' border-blue-500 bg-blue-50 text-blue-800' : '')}>{(search.get('window') ?? '15m') === window && <span aria-hidden="true">✓ </span>}{windows[window]}</button>)}
      </div><div className="flex items-center gap-3 text-xs"><button type="button" className={control} onClick={() => { if (search.has('asOf')) update({ asOf: null }); else setRevision(value => value + 1); }}>Osveži meritve</button><a className="text-blue-700 underline" href={'/api/admin/analytics/diagnostics?' + exportParams}>Izvoz CSV</a></div></div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[11px] text-slate-500">Vrsta meritve<select className={control + ' max-w-full'} value={search.get('kind') ?? 'all'} onChange={event => update({ kind: event.target.value })}><option value="all">Vse meritve</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <form className="flex min-w-0 flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); update({ context }); }}><label className="grid min-w-0 gap-1 text-[11px] text-slate-500">Kontekst<input className={control + ' w-56 max-w-full'} list="diagnostic-contexts" value={context} onChange={event => setContext(event.target.value)} placeholder="Vse poti" /></label><datalist id="diagnostic-contexts">{data?.contexts.map(value => <option key={value} value={value} />)}</datalist><button className={control}>Uporabi kontekst</button>{search.get('context') && <button type="button" className={control} onClick={() => { setContext(''); update({ context: null }); }}>Vse poti</button>}</form>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={search.get('errors') === 'true'} onChange={event => update({ errors: event.target.checked ? 'true' : null })} />Samo napake</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={automatic} onChange={event => { setAutomatic(event.target.checked); if (search.has('asOf')) update({ asOf: null }); }} />Osveževanje na 15 s</label>
      </div>
      {data && <p className="mt-3 text-[11px] text-slate-500">{dateLabel(data.filters.start)} – {dateLabel(data.asOf)} · Europe/Ljubljana · granula {data.filters.bucketMinutes} min</p>}
    </section>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={() => setRevision(value => value + 1)}>Poskusi znova</button></div> : loading ? <p role="status" className="p-8 text-sm text-slate-500">Nalaganje diagnostičnih meritev …</p> : data && <>
      <p className="text-xs leading-relaxed text-slate-500">Zbiranje uporablja trajne zapise v bazi in sedemdnevno hrambo. {data.coverage.firstRecordedAt ? 'Prva ohranjena meritev: ' + dateLabel(data.coverage.firstRecordedAt) + '.' : 'Novi zbiralnik še nima zabeleženih meritev.'} {!data.coverage.completeWindow && 'Za del izbranega okna zgodovina še ni na voljo.'} Prikazane so instrumentirane operacije; to ni seznam vseh omrežnih zahtev.</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{[
        ['Izbrane meritve', numeric(data.summary.observations, 0), 'Vsi zapisi pod izbranimi filtri'],
        ['Napake', numeric(data.summary.errors, 0), percent(data.summary.errorRate) + ' izbranih meritev'],
        ['p95 trajanja', numeric(data.summary.p95Ms) + ' ms', '95. percentil veljavnih trajanj'],
        ['Zahteve', numeric(data.summary.routes, 0), 'Zaključene merjene zahteve'],
        ['Merjen prenos', data.summary.payloadMeasured ? bytes(data.summary.payloadBytes) : 'Ni izmerjeno', data.summary.payloadMeasured + ' meritev; ocena serializiranega izhoda']
      ].map(([label, value, hint]) => <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-semibold text-slate-900">{value}</p><p className="mt-2 text-[11px] text-slate-500">{hint}</p></article>)}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        <BusinessChart title="Meritve in napake skozi čas" description="Enako izbrano okno, brez preklopa na drug časovni obseg. Prazna zgodovina ni ničla." data={[
          { type: 'scatter', mode: 'lines+markers', name: 'Meritve', x: data.series.map(point => point.timestamp), y: data.series.map(point => point.observations), line: { color: '#2563eb' }, connectgaps: false },
          { type: 'scatter', mode: 'lines+markers', name: 'Napake', x: data.series.map(point => point.timestamp), y: data.series.map(point => point.errors), line: { color: '#b45309' }, connectgaps: false }
        ]} layout={{ xaxis: { tickvals: ticks.map(point => point.timestamp), ticktext: ticks.map(point => chartDateLabel(point.timestamp)), automargin: true, gridcolor: '#f1f5f9' } }} yTitle="Število meritev" columns={['Čas', 'Meritve', 'Napake']} rows={data.series.map(point => ({ values: [dateLabel(point.timestamp), point.observations, point.errors] }))} />
        <BusinessChart title="Trajanje operacij" description="Povprečje in p95 vseh izmerjenih trajanj v granuli. Ni meritev pomeni manjkajočo točko." data={[
          { type: 'scatter', mode: 'lines+markers', name: 'Povprečje', x: data.series.map(point => point.timestamp), y: data.series.map(point => point.meanMs), line: { color: '#15803d' }, connectgaps: false },
          { type: 'scatter', mode: 'lines+markers', name: 'p95', x: data.series.map(point => point.timestamp), y: data.series.map(point => point.p95Ms), line: { color: '#7c3aed' }, connectgaps: false }
        ]} layout={{ xaxis: { tickvals: ticks.map(point => point.timestamp), ticktext: ticks.map(point => chartDateLabel(point.timestamp)), automargin: true, gridcolor: '#f1f5f9' } }} yTitle="Milisekunde" columns={['Čas', 'Povprečje ms', 'p95 ms']} rows={data.series.map(point => ({ values: [dateLabel(point.timestamp), point.meanMs, point.p95Ms] }))} />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold">Počasne poti, napake in faze</h2><p className="my-3 text-xs leading-relaxed text-slate-500">Razvrščeno po napakah in p95. Faze DB, predpomnilnik in obdelava veljajo za merjene zahteve. Vsote sočasnih ali gnezdenih faz se lahko prekrivajo in niso razčlenitev skupnega časa. Izvedbe brez predpomnilnika: {data.summary.cacheExecutions}; razveljavitve: {data.summary.invalidations}. Iz njih ne sklepamo o številu zadetkov.</p><DataTable columns={['Pot', 'Operacija', 'Vrsta', 'Meritve', 'Napake', 'Povp. ms', 'p95 ms', 'DB povp. ms', 'Predpomnilnik ms', 'Obdelava ms', 'Merjen prenos', 'Nazadnje']} rows={data.groups.map(row => ({ values: [row.context, row.operation, labels[row.kind], row.count, row.errors, row.meanMs, row.p95Ms, row.dbMs, row.cacheMs, row.transformMs, row.payloadMeasured ? bytes(row.payloadBytes) : 'Ni izmerjeno', dateLabel(row.lastSeen)] }))} /></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold">Zadnje meritve in sled zahtev</h2><p className="my-3 text-xs text-slate-500">Zadnjih 50 izbranih zapisov. Odprite sled za izmerjene podoperacije, faze in ponovljena branja. Vsebine zahtev, glave in osebni podatki se ne shranjujejo.</p><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Čas', 'Pot', 'Operacija', 'Trajanje', 'Stanje', 'Sled'].map(value => <th key={value} scope="col" className="whitespace-nowrap p-2 text-slate-500">{value}</th>)}</tr></thead><tbody>{data.recent.map(event => <tr key={event.id} className="border-t border-slate-100"><td className="whitespace-nowrap p-2">{dateLabel(event.recordedAt)}</td><td className="p-2">{event.context}</td><td className="p-2">{event.operation}</td><td className="whitespace-nowrap p-2">{numeric(event.durationMs)} ms</td><td className="p-2">{event.errorCode ?? 'V redu'}</td><td className="p-2"><button type="button" className="text-blue-700 underline" onClick={() => setTraceId(event.traceId)}>Odpri sled</button></td></tr>)}</tbody></table>{!data.recent.length && <p className="py-5 text-xs text-slate-500">Ni meritev pod izbranimi filtri.</p>}</div></section>
    </>}
    {traceId && <dialog ref={dialog} onCancel={() => setTraceId(null)} className="m-auto max-h-[90vh] w-[min(1100px,95vw)] rounded-xl border border-slate-200 p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/40"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Sled merjene zahteve</h2><p className="mt-1 break-all text-[11px] text-slate-500">{traceId}</p></div><button type="button" className={control} onClick={() => setTraceId(null)}>Zapri</button></div>{traceError ? <p role="alert">{traceError}</p> : !trace ? <p role="status">Nalaganje sledi …</p> : <><DataTable columns={['Operacija', 'Pot', 'Vrsta', 'Čas', 'Trajanje ms', 'Stanje', 'Merjen prenos']} rows={tableEvents(trace.recent)} /><p className="mt-3 text-xs text-slate-500">{trace.recent.length} ohranjenih podoperacij. {trace.coverage.traceLimited ? 'Prikaz je omejen na 500.' : ''}</p>{trace.recent.filter(event => event.kind === 'route').map(event => <div key={event.id} className="mt-4 space-y-2 text-xs"><p>Faze (ms): {Object.entries(event.phases).map(([name, value]) => name + ' ' + numeric(value)).join(' · ') || 'Ni ločenih meritev.'}</p><p>Izpuščene podoperacije zaradi omejitve: {String(event.details.droppedSpans ?? 0)}.</p><p>Največji izmerjeni izhod: {String(event.details.largestPayloadProducer ?? 'Ni izmerjeno')}.</p><p>Ponovljene operacije: {Array.isArray(event.details.repeatedHelpers) ? event.details.repeatedHelpers.map((helper: { name: string; count: number }) => helper.name + ' × ' + helper.count).join(' · ') || 'Ni zabeleženih.' : 'Ni zabeleženih.'}</p></div>)}</>}</dialog>}
  </div>;
}
