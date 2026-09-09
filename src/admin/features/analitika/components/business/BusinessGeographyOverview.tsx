'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { readAnalyticsJson } from '@/shared/client/readAnalyticsJson';
import type { GeographyReference } from '@/shared/domain/analytics/geography';
import { formatSlOrderCount } from '@/shared/domain/formatting';
import EuiTabs from '@/shared/ui/eui-tabs';
import { adminAnalyticsPanelClassName } from '@/shared/ui/theme/tokens';
import { eur, numeric } from '../../lib/formatting';
import type { Drill } from './BusinessChart';
import { geographyBounds, geographyColors, geographyPath, type GeographyOverviewArea, type GeographyResponse } from './geographyPresentation';

type Props = { query: string; onOpen: () => void; onDrill: (drill: Drill) => void };

export default function BusinessGeographyOverview({ query, onOpen, onDrill }: Props) {
  const [level, setLevel] = useState<'municipality' | 'region'>('region');
  const [data, setData] = useState<GeographyResponse | null>(null);
  const [geometry, setGeometry] = useState<GeographyReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [hoveredId, setHoveredId] = useState('');
  const missingPatternId = useId();
  const params = new URLSearchParams(query);
  params.set('basis', 'paid');
  for (const key of ['area', 'areaId', 'municipalityId', 'regionId', 'level', 'export']) params.delete(key);
  const requestKey = params.toString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const response = await fetch('/api/admin/analytics/geography?' + requestKey, { signal: controller.signal, cache: 'no-store' });
        const payload = await readAnalyticsJson<GeographyResponse>(response, 'Geografije plačanih naročil ni mogoče naložiti.');
        if (payload.basis !== 'paid') throw new Error('Plačana geografska analitika trenutno ni na voljo.');
        const boundaryResponse = await fetch(payload.reference.assetUrl + '?version=' + encodeURIComponent(payload.reference.metadata.version), { signal: controller.signal });
        const boundaries = await readAnalyticsJson<GeographyReference>(boundaryResponse, 'Uradnih meja ni mogoče naložiti.');
        if (boundaries.metadata.version !== payload.reference.metadata.version) throw new Error('Različici zemljevida in geografskih podatkov se ne ujemata.');
        if (!controller.signal.aborted) { setData(payload); setGeometry(boundaries); }
      } catch (failure) {
        if (!controller.signal.aborted) { setData(null); setGeometry(null); setError(failure instanceof Error ? failure.message : 'Zemljevida ni mogoče naložiti.'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [requestKey, revision]);

  const features = useMemo(() => geometry?.features.filter(feature => feature.properties.level === level) ?? [], [geometry, level]);
  const paths = useMemo(() => features.map(feature => ({ feature, path: geographyPath(feature) })), [features]);
  const bounds = useMemo(() => geographyBounds(features), [features]);
  const areas = useMemo(() => (data?.areas ?? []).filter(area => area.level === level), [data, level]);
  const byId = useMemo(() => new Map(areas.map(area => [area.id, area])), [areas]);
  const ranked = useMemo(() => areas.filter(area => area.orderCount > 0).sort((left, right) => right.orderCount - left.orderCount || left.name.localeCompare(right.name, 'sl')).slice(0, 5), [areas]);
  const maximum = ranked[0]?.orderCount ?? 0;
  const mappedCount = areas.reduce((total, area) => total + area.orderCount, 0);
  const color = (area: GeographyOverviewArea | undefined) => !area ? `url(#${missingPatternId})` : area.orderCount <= 0 || maximum <= 0 ? geographyColors[0] : geographyColors[Math.min(5, Math.max(1, Math.ceil(area.orderCount / maximum * 5)))];
  const selectArea = (area: GeographyOverviewArea) => onDrill({ kind: 'orders', basis: 'paid', area: area.id, level });

  return <article className={adminAnalyticsPanelClassName + ' flex h-full flex-col !p-3'} aria-label="Geografija plačanih naročil">
    <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <h2 className="text-sm font-semibold text-slate-950">Plačana naročila po Sloveniji</h2>
      <EuiTabs value={level} onChange={next => { setLevel(next as typeof level); setHoveredId(''); }} variant="secondary" surface="panel" ariaLabel="Raven preglednega zemljevida" className="!w-auto" tabClassName="!h-7 !min-w-[54px] !px-2 !text-[11px]" tabs={[{ value: 'municipality', label: 'Občine' }, { value: 'region', label: 'Regije' }]} />
    </header>
    <div className="min-h-[150px] flex-1" aria-busy={loading}>
      {error ? <div role="alert" className="flex min-h-[150px] items-center text-xs text-red-700"><p>{error}<button type="button" className="ml-2 underline" onClick={() => setRevision(value => value + 1)}>Poskusi znova</button></p></div> : loading || !data || !geometry ? <p role="status" className="flex min-h-[150px] items-center justify-center text-xs text-slate-500">Nalaganje zemljevida …</p> : <div className="grid items-center gap-3 pt-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <div className="min-w-0">
          <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} className="h-[145px] w-full" role="group" aria-label={`Plačana naročila v Sloveniji: ${level === 'municipality' ? 'občine' : 'regije'}. Izberite območje za naročila.`}>
            <defs><pattern id={missingPatternId} width=".01" height=".01" patternUnits="userSpaceOnUse"><rect width=".01" height=".01" fill="#e2e8f0" /><path d="M0,0L.01,.01" stroke="#94a3b8" strokeWidth=".002" /></pattern></defs>
            {paths.map(({ feature, path }) => {
              const area = byId.get(feature.properties.id);
              return <path key={feature.properties.id} d={path} fill={color(area)} fillRule="evenodd" stroke={hoveredId === feature.properties.id ? '#166534' : '#fff'} strokeWidth={hoveredId === feature.properties.id ? 1.8 : .6} vectorEffect="non-scaling-stroke" role="button" tabIndex={area ? 0 : -1} aria-label={`${feature.properties.name}: ${area ? formatSlOrderCount(area.orderCount) + ', plačano' : 'ni podatka'}`} className="cursor-pointer outline-none focus:stroke-slate-900 focus:stroke-[2]" onPointerEnter={() => setHoveredId(feature.properties.id)} onPointerLeave={() => setHoveredId('')} onFocus={() => setHoveredId(feature.properties.id)} onBlur={() => setHoveredId('')} onClick={() => { if (area) selectArea(area); }} onKeyDown={event => { if (area && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectArea(area); } }}><title>{feature.properties.name} · {area ? formatSlOrderCount(area.orderCount) : 'Ni podatka'} · {eur(area?.activityValue)}</title></path>;
            })}
          </svg>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500" aria-label="Barvna lestvica števila plačanih naročil"><span>0</span>{(maximum > 0 ? geographyColors : geographyColors.slice(0, 1)).map((shade, index) => <span key={shade} aria-hidden="true" className="h-2 w-3 rounded-sm" style={{ backgroundColor: shade, ...(index === 0 ? { border: '1px solid #cbd5e1' } : {}) }} />)}{maximum > 0 && <span>{numeric(maximum, 0)}</span>}</div>
        </div>
        <div className="min-w-0 self-stretch pt-1">
          <p className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-slate-400"><span>Največ naročil</span><span>Št.</span></p>
          {ranked.length ? <ol className="space-y-0.5">{ranked.map((area) => <li key={area.id}>
            <button type="button" onClick={() => selectArea(area)} onPointerEnter={() => setHoveredId(area.id)} onPointerLeave={() => setHoveredId('')} onFocus={() => setHoveredId(area.id)} onBlur={() => setHoveredId('')} className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,.7fr)_auto] items-center gap-2 rounded-md px-1 py-1.5 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-1 focus-visible:ring-[color:var(--blue-500)]" aria-label={`${area.name}: ${formatSlOrderCount(area.orderCount)}, plačano. Odpri naročila.`}>
              <span className="min-w-0 truncate text-[11px] leading-3 text-slate-600" title={area.name}>{area.name}</span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${area.orderCount / maximum * 100}%` }} /></span>
              <span className="text-[11px] font-semibold leading-3 tabular-nums text-slate-800">{numeric(area.orderCount, 0)}</span>
            </button>
          </li>)}</ol> : <p className="py-7 text-xs leading-relaxed text-slate-500">Ni plačanih naročil z znanim {level === 'municipality' ? 'pripisom občini' : 'pripisom regiji'}.</p>}
        </div>
      </div>}
    </div>
    <footer className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-1.5 text-[10px] leading-4 text-slate-500">
      <p className="min-w-0" title={data ? `Plačana naročila po datumu naročila. Zemljevid in lestvica vključujeta le naročila z znanim območjem; tuji in nerazrešeni naslovi niso razporejeni po Sloveniji. Samo regija: ${numeric(data.reconciliation.regionOnlyResolvedOrders, 0)}.` : undefined}>{data && !loading ? <>Prikazano {numeric(mappedCount, 0)} od {numeric(data.reconciliation.allEligibleOrders, 0)} plačanih naročil.</> : 'Plačana naročila po datumu naročila.'} <span className="ml-1 cursor-help text-slate-400" title={data ? `Vir meja: ${data.reference.metadata.attribution} · ${data.reference.metadata.licence} · ${data.reference.metadata.version}` : 'Vir meja: GURS'}>GURS</span></p>
      <button type="button" onClick={onOpen} className="shrink-0 text-[11px] text-blue-700 hover:underline focus-visible:underline focus-visible:outline-none">Celoten zemljevid →</button>
    </footer>
  </article>;
}
