'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPeriodSelector from '@/shared/ui/admin-period-selector';
import AdminAnalyticsMetricCard from '@/shared/ui/admin-analytics-metric-card';
import { buttonTokenClasses, adminAnalyticsControlClassName, adminAnalyticsPanelClassName } from '@/shared/ui/theme/tokens';
import BusinessChart, { DataTable, numeric, percent } from '../business/BusinessChart';
import { websiteExportRows, type WebsiteBreakdown, type WebsiteExport, type WebsiteTraffic } from '@/shared/domain/analytics/websiteTraffic';

const control = adminAnalyticsControlClassName;
const formatDate = (date: string) => new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
function Breakdown({ title, kind, rows, exportHref }: { title: string; kind: 'pages' | 'products'; rows: WebsiteBreakdown[]; exportHref: string }) {
  const [search, setSearch] = useState('');
  const visible = rows.filter(row => (row.key ?? '').toLocaleLowerCase('sl').includes(search.toLocaleLowerCase('sl')));
  return <section className={adminAnalyticsPanelClassName} aria-label={title}>
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-950">{title}</h2><a href={exportHref} className="text-xs text-blue-700 underline">CSV · vse vrstice</a></div>
    <p className="mt-1 text-[11px] text-slate-500">{rows.length} skupin · {numeric(rows.reduce((sum, row) => sum + row.views, 0), 0)} zabeleženih ogledov. Obiskovalci in seje se med vrsticami lahko ponovijo.</p>
    <input aria-label={'Poišči: ' + title} placeholder={kind === 'pages' ? 'Poišči pot …' : 'Poišči ID artikla …'} value={search} onChange={event => setSearch(event.target.value)} className={control + ' my-3 w-full'} />
    <DataTable columns={[kind === 'pages' ? 'Pot strani' : 'ID artikla', 'Ogledi', 'Seje', 'Obiskovalci']} rows={visible.map(row => ({ values: [row.key ?? (kind === 'pages' ? 'Neznana pot' : 'Manjka ID artikla'), row.views, row.visits, row.visitors] }))} />
  </section>;
}

export default function WebsiteDashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const query = search.toString();
  const range = search.get('range') ?? (search.has('from') || search.has('to') ? 'custom' : '90D');
  const [data, setData] = useState<WebsiteTraffic | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [customFrom, setCustomFrom] = useState(search.get('from') ?? '');
  const [customTo, setCustomTo] = useState(search.get('to') ?? '');
  useEffect(() => { setCustomFrom(search.get('from') ?? ''); setCustomTo(search.get('to') ?? ''); }, [query, search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const params = new URLSearchParams(query); params.delete('export');
    fetch('/api/admin/analytics/website?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.message || 'Spletna analitika ni na voljo.'); return value as WebsiteTraffic; })
      .then(value => { if (!controller.signal.aborted) setData(value); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Spletna analitika ni na voljo.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, reload]);
  const changePeriod = (next: string) => {
    const params = new URLSearchParams(); params.set('range', next);
    if (next === 'custom') { if (customFrom) params.set('from', customFrom); if (customTo) params.set('to', customTo); }
    router.replace('/admin/analitika/splet?' + params, { scroll: false });
  };
  const exportHref = (kind: WebsiteExport) => {
    const params = new URLSearchParams(query); params.set('export', kind);
    if (data) params.set('asOf', data.asOf);
    return '/api/admin/analytics/website?' + params;
  };
  const daily = data ? websiteExportRows(data, 'days') : null;
  const cohorts = data ? websiteExportRows(data, 'cohorts') : null;
  return <div className="space-y-4" aria-busy={loading}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-950">Splet</h1><p className="mt-1 text-xs text-slate-500">Zabeležen obisk, vsebina in vračanje obiskovalcev.</p></div><button type="button" className={buttonTokenClasses.control} onClick={() => setReload(value => value + 1)}>Osveži</button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3" aria-label="Obdobje spletne analitike">
      <AdminPeriodSelector value={range} onChange={changePeriod} ariaLabel="Obdobje spletne analitike" />
      <label className="flex items-center gap-1 text-xs text-slate-500">Od<input aria-label="Splet: začetni datum" type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className={control} /></label>
      <label className="flex items-center gap-1 text-xs text-slate-500">Do<input aria-label="Splet: končni datum" type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className={control} /></label>
      <button type="button" className={buttonTokenClasses.control} onClick={() => changePeriod('custom')}>Uporabi datuma</button>
    </div>
    {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nalaganje spletne analitike …</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-2 underline">Poskusi znova</button></div>}
    {data && <>
      <div className="text-xs leading-relaxed text-slate-500"><p>{formatDate(data.period.from)}–{formatDate(data.period.to)} · Europe/Ljubljana{data.period.partialToday ? ' · današnji dan je delen' : ''} · stanje {new Intl.DateTimeFormat('sl-SI', { timeZone: data.timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.asOf))}</p>
        <p>Zgodovina ogledov od {data.coverage.historyFrom ? new Intl.DateTimeFormat('sl-SI', { timeZone: data.timezone, dateStyle: 'medium' }).format(new Date(data.coverage.historyFrom)) : 'še ni zabeleženih dogodkov'}. Odsotnost dogodkov ne dokazuje neprekinjenega merjenja.</p></div>
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Obiski (seje)', numeric(data.summary.visits, 0), 'Različni ID-ji sej z ogledom strani.'],
          ['Obiskovalci', numeric(data.summary.visitors, 0), 'Različni ID-ji brskalnikov z ogledom strani.'],
          ['Ogledi strani', numeric(data.summary.pageViews, 0), 'Vsi zabeleženi dogodki page_view.'],
          ['Ogledi artiklov', numeric(data.summary.productViews, 0), 'Vsi zabeleženi dogodki product_view.'],
          ['Vračajoči obiskovalci', numeric(data.summary.returningVisitors, 0), 'Z ogledom na katerikoli prejšnji koledarski dan.']
        ].map(([label, value, note]) => <AdminAnalyticsMetricCard key={label} title={label} metric={value}>{note}</AdminAnalyticsMetricCard>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <BusinessChart title="Dnevni obisk" description="Koledarski dnevi v Ljubljani; ponovljeni ogledi iste seje ne ustvarijo novega obiska. Seje in obiskovalci so deduplicirani tudi za celotno obdobje, zato vsota dnevnih vrednosti ni nujno skupni rezultat." xTitle="Dan" yTitle="Zabeleženo število" data={[
          { type: 'scatter', mode: 'lines+markers', marker: { size: 5 }, name: 'Ogledi strani', x: data.days.map(row => row.date), y: data.days.map(row => row.pageViews), connectgaps: false },
          { type: 'scatter', mode: 'lines+markers', marker: { size: 5 }, name: 'Seje', x: data.days.map(row => row.date), y: data.days.map(row => row.visits), connectgaps: false },
          { type: 'scatter', mode: 'lines+markers', marker: { size: 5 }, name: 'Obiskovalci', x: data.days.map(row => row.date), y: data.days.map(row => row.visitors), connectgaps: false }
        ]} layout={{ xaxis: { tickformat: '%d.%m.%Y', title: { text: 'Dan' }, automargin: true }, yaxis: { rangemode: 'tozero', dtick: data.summary.pageViews <= 5 ? 1 : undefined, title: { text: 'Zabeleženo število' }, automargin: true } }} columns={daily!.columns} rows={daily!.rows.map(values => ({ values }))} empty={!data.days.some(day => day.available)} height={230}>
          <a href={exportHref('days')} className="mt-2 inline-block text-[11px] text-blue-700 underline">Izvozi dnevno tabelo za prikazano stanje</a>
        </BusinessChart>
        <BusinessChart title="Vrnitev sedmi dan (D7)" description="Kohorta je dan prvega zabeleženega ogleda. Vrnitev pomeni vsaj en ogled natanko sedmi koledarski dan po njem. Upoštevamo le kohorte, katerih celoten sedmi dan je že potekel; spremljanje sega do prikazanega referenčnega časa." xTitle="Prvi zabeleženi dan" yTitle="Delež D7" data={[{ type: 'bar', name: 'Delež D7', x: data.cohorts.map(row => row.date), y: data.cohorts.map(row => row.rateD7) }]} layout={{ yaxis: { tickformat: '.0%', range: [0, 1], title: { text: 'Delež D7' } } }} columns={cohorts!.columns} rows={cohorts!.rows.map(values => ({ values }))} empty={!data.retention.eligibleVisitors} height={230}>
          <p className="mt-2 text-xs text-slate-600">{percent(data.retention.rateD7)} · {numeric(data.retention.returnedD7, 0)} / {numeric(data.retention.eligibleVisitors, 0)} zrelih obiskovalcev · {numeric(data.retention.immatureVisitors, 0)} še nezrelih.</p>
          <a href={exportHref('cohorts')} className="mt-2 inline-block text-[11px] text-blue-700 underline">Izvozi kohorte za prikazano stanje</a>
        </BusinessChart>
      </div>
      <div className="grid gap-4 xl:grid-cols-2"><Breakdown title="Ogledi po straneh" kind="pages" rows={data.pages} exportHref={exportHref('pages')} /><Breakdown title="Ogledi po artiklih" kind="products" rows={data.products} exportHref={exportHref('products')} /></div>
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-slate-800">Definicije in pokritost meritev</summary><div className="mt-3 space-y-2 leading-relaxed">
        <p>Obisk je zabeleženi ID seje (piškotek ath_sid), ki mu zbiralnik ob dogodku podaljša veljavnost za štiri ure. Obiskovalec je ID brskalnika (ath_vid), ne prijavljen uporabnik ali oseba. Blokiranje ali brisanje piškotkov in uporaba več naprav lahko spremenijo štetje. Avtomatiziran promet ni ločeno prepoznan.</p>
        <p>Prvič zabeleženi obiskovalci v obdobju: {numeric(data.summary.firstObservedVisitors, 0)}. Obiskovalec se lahko v istem obdobju prvič pojavi in vrne drug dan, zato se ta skupina prekriva z vračajočimi. Več ogledov istega dne samo po sebi ne pomeni vrnitve.</p>
        <p>Kohorte temeljijo na razpoložljivi zgodovini brskalniških ID-jev, ne na znanem prvem obisku v življenju. Dnevi pred začetkom zgodovine in nezrele kohorte so označeni kot manjkajoči. Ničle pozneje pomenijo nič zabeleženih dogodkov, ne dokaza, da je zbiranje delovalo brez prekinitve.</p>
        <p>Ogledi strani brez ID-ja obiskovalca: {data.coverage.missingVisitorPageViews}; brez ID-ja seje: {data.coverage.missingSessionPageViews}; brez poti: {data.coverage.missingPathPageViews}. Ogledi artiklov brez ID-ja: {data.coverage.missingProductViews}. Ti ogledi ostanejo v skupnem številu; brez ID-ja seje ali obiskovalca ne povečajo razločnega štetja.</p>
        <p>Trajanje seje, odboji, prodajni lijak in identiteta prijavljenih uporabnikov nimajo zadostnih dogodkov za zanesljiv izračun. Ta pogled jih ne ocenjuje.</p>
      </div></details>
    </>}
  </div>;
}
