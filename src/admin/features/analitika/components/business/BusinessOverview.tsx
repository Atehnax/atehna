'use client';

import { useState, type ReactNode } from 'react';
import type { BusinessAnalyticsResponse, BusinessView } from '@/shared/domain/analytics/businessAnalytics';
import AdminAnalyticsMetricCard from '@/shared/ui/admin-analytics-metric-card';
import { adminAnalyticsControlClassName, adminAnalyticsPanelClassName } from '@/shared/ui/theme/tokens';
import { eur, numeric, percent, formatAnalyticsCalendarDay as dayLabel } from '../../lib/formatting';
import AdminOrdersActivityHeatmap from '../AdminOrdersActivityHeatmap';
import BusinessChart, { type Drill } from './BusinessChart';
import BusinessGeographyOverview from './BusinessGeographyOverview';

// An unknown day makes subsequent cumulative totals unknown too.
function cumulative(values: Array<number | null>) {
  let cents: number | null = 0;
  return values.map(value => {
    cents = value == null || cents == null ? null : cents + Math.round(value * 100);
    return cents == null ? null : cents / 100;
  });
}

function ChartSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <dl className="grid grid-cols-3 divide-x divide-slate-200">{items.map(item => <div key={item.label} className="min-w-0 px-3 first:pl-0 last:pr-0"><dt className="text-[10px] uppercase leading-4 text-slate-500">{item.label}</dt><dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">{item.value}</dd></div>)}</dl>;
}

export default function BusinessOverview({ data, query, onDrill, onNavigate, children }: {
  data: BusinessAnalyticsResponse;
  query: string;
  onDrill: (drill: Drill) => void;
  onNavigate: (view: BusinessView, changes?: Record<string, string>) => void;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState<'daily' | 'average'>('daily');
  const [values, setValues] = useState<'cumulative' | 'daily'>('cumulative');
  const days = data.paid.days;
  const dailyValues = days.map(day => day.available && day.valueCount === day.orderCount ? day.activityValue : null);
  const completeValues = dailyValues.every(value => value != null);
  const valueMode = values === 'cumulative' && !completeValues ? 'daily' : values;
  const valueSeries = valueMode === 'cumulative' ? cumulative(dailyValues) : dailyValues;
  const priorSeries = valueMode === 'cumulative' ? cumulative(days.map(day => day.previousValue)) : days.map(day => day.previousValue);
  const observedDays = days.filter(day => day.available);
  const ticks = days.filter((_, index) => index % Math.max(1, Math.ceil(days.length / 5)) === 0);
  const xaxis = { type: 'date' as const, tickvals: ticks.map(day => day.date), ticktext: ticks.map(day => new Intl.DateTimeFormat('sl-SI', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(day.date + 'T12:00:00Z'))), showgrid: false, zeroline: false, automargin: true };
  const yaxis = { gridcolor: '#e2e8f0', griddash: 'dot' as const, zerolinecolor: '#e2e8f0', rangemode: 'tozero' as const, automargin: true };
  const dailyDrills = days.map(day => JSON.stringify({ kind: 'orders', basis: 'paid', date: day.date }));
  const customers = data.customers.customers;
  const customerTotal = customers.reduce((sum, customer) => sum + customer.value, 0);
  const leaders = customers.slice(0, 4);
  const rest = Math.max(0, customerTotal - leaders.reduce((sum, customer) => sum + customer.value, 0));
  const concentrationRows = [...leaders.map(customer => ({ label: customer.label, value: customer.value, key: customer.key })), ...(customers.length > 4 ? [{ label: 'Ostali', value: rest, key: null }] : [])];
  const largestShare = Math.max(...concentrationRows.map(row => row.value), 1);
  const paidDrill = () => onDrill({ kind: 'orders', basis: 'paid' });

  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <AdminAnalyticsMetricCard title="Število plačanih naročil" metric={numeric(data.paid.count, 0)} onClick={paidDrill}>Prej: {numeric(data.paid.previousCount, 0)}</AdminAnalyticsMetricCard>
      <AdminAnalyticsMetricCard title="Vrednost plačanih naročil" metric={eur(data.paid.value)} onClick={paidDrill}>Izbrano obdobje · brez DDV</AdminAnalyticsMetricCard>
      <AdminAnalyticsMetricCard title="Povprečno plačano naročilo" metric={eur(data.paid.orders.statistics.mean)} onClick={paidDrill}>Znana vrednost: {data.paid.valueOrders}/{data.paid.count}</AdminAnalyticsMetricCard>
      <AdminAnalyticsMetricCard title="Mediana plačanega naročila" metric={eur(data.paid.orders.statistics.median)} onClick={paidDrill}>Izbrano obdobje · brez DDV</AdminAnalyticsMetricCard>
      <AdminAnalyticsMetricCard title="Sprejem ponudb v 30 dneh" metric={percent(data.quotes.enabled ? data.quotes.mature.rate : null)} onClick={() => onNavigate('ponudbe')}>{data.quotes.enabled ? 'Prodajni potek · ponudbe ≥ 30 dni' : 'Prodajni potek · datum ni nastavljen'}</AdminAnalyticsMetricCard>
    </div>
    <p className="text-[11px] leading-4 text-slate-500">Plačana naročila po datumu naročila · blago brez DDV in poštnine, pred vračili. Preklicana, zavrnjena in povrnjena so izključena.</p>
    <div className="grid gap-3 xl:grid-cols-2">
      <BusinessChart compact title="Plačana naročila po dnevih" description={counts === 'daily' ? 'Dnevno število plačanih naročil' : 'Drseče povprečje sedmih koledarskih dni'}
        toolbar={<select aria-label="Prikaz števila naročil" className={adminAnalyticsControlClassName} value={counts} onChange={event => setCounts(event.target.value as typeof counts)}><option value="daily">Dnevno</option><option value="average">7-dnevno povprečje</option></select>}
        data={[counts === 'daily'
          ? { type: 'bar', x: days.map(day => day.date), y: days.map(day => day.available ? day.orderCount : null), marker: { color: '#64748b' }, customdata: dailyDrills, hovertemplate: '%{x|%d. %m. %Y}<br>Naročila: %{y}<extra></extra>' }
          : { type: 'scatter', mode: 'lines', x: days.map(day => day.date), y: days.map(day => day.rollingCount7), line: { color: '#2563eb', width: 2 }, connectgaps: false, hovertemplate: '%{x|%d. %m. %Y}<br>7-dnevno povprečje: %{y:.2f}<extra></extra>' }]}
        layout={{ xaxis, yaxis, bargap: .3 }}
        rows={days.map(day => ({ values: [day.date + (day.partial ? ' (delno)' : ''), day.available ? day.orderCount : null, day.rollingCount7], drill: { kind: 'orders', basis: 'paid', date: day.date } }))}
        columns={['Datum', 'Plačana naročila', '7-dnevno povprečje']} onDrill={onDrill} empty={!observedDays.length}
        footer={<ChartSummary items={[
          { label: 'Skupaj', value: numeric(data.paid.count, 0) },
          { label: 'Dnevno povprečje', value: numeric(observedDays.length ? data.paid.count / observedDays.length : null, 1) },
          { label: 'Največ v dnevu', value: numeric(observedDays.length ? Math.max(...observedDays.map(day => day.orderCount)) : null, 0) }
        ]} />} />
      <BusinessChart compact title="Vrednost plačanih naročil" description={valueMode === 'cumulative' ? 'Kumulativna vrednost blaga brez DDV' : completeValues ? 'Dnevna vrednost blaga brez DDV' : 'Dnevno · za kumulativni prikaz manjka del podatkov'}
        toolbar={<select aria-label="Prikaz vrednosti naročil" className={adminAnalyticsControlClassName} value={valueMode} onChange={event => setValues(event.target.value as typeof values)}><option value="cumulative" disabled={!completeValues}>Kumulativno</option><option value="daily">Dnevno</option></select>}
        data={[
          { type: 'scatter', mode: 'lines', name: 'Izbrano obdobje', x: days.map(day => day.date), y: valueSeries, text: valueSeries.map(value => eur(value)), line: { color: '#334155', width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(100,116,139,0.10)', connectgaps: false, ...(valueMode === 'daily' ? { customdata: dailyDrills } : {}), hovertemplate: '%{x|%d. %m. %Y}<br>%{text}<extra></extra>' },
          { type: 'scatter', mode: 'lines', name: 'Prejšnje obdobje', x: days.map(day => day.date), y: priorSeries, text: priorSeries.map((value, index) => (days[index].previousDate ? dayLabel(days[index].previousDate!) + ' · ' : '') + eur(value)), line: { color: '#94a3b8', width: 1.5, dash: 'dash' }, connectgaps: false, hovertemplate: '%{text}<extra></extra>' }
        ]}
        layout={{ xaxis, yaxis: { ...yaxis, ticksuffix: ' €' } }}
        rows={days.map((day, index) => ({ values: [day.date + (day.partial ? ' (delno)' : ''), valueSeries[index], priorSeries[index], day.previousDate], ...(valueMode === 'daily' ? { drill: { kind: 'orders', basis: 'paid', date: day.date } } : {}) }))}
        columns={['Datum', valueMode === 'cumulative' ? 'Kumulativno (EUR)' : 'Vrednost (EUR)', 'Prejšnje obdobje (EUR)', 'Primerjalni datum']} onDrill={onDrill} empty={!valueSeries.some(value => value != null)}
        footer={<ChartSummary items={[
          { label: 'Skupaj', value: eur(data.paid.value) },
          { label: 'Povprečje', value: eur(data.paid.orders.statistics.mean) },
          { label: 'Mediana', value: eur(data.paid.orders.statistics.median) }
        ]} />} />
    </div>
    <AdminOrdersActivityHeatmap compact customerType={data.filters.customerType} status={data.filters.status} source={data.filters.source} entrySource={data.filters.entrySource ?? 'all'} history={data.filters.history ?? 'all'} />
    <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
      <BusinessGeographyOverview query={query} onOpen={() => onNavigate('zemljevid', { basis: 'paid' })} onDrill={onDrill} />
      <article className={adminAnalyticsPanelClassName + ' flex flex-col !p-3'}>
        <h2 className="text-sm font-semibold text-slate-950">Koncentracija naročnikov</h2>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Delež znane nenegativne vrednosti plačanih naročil</p>
        {customerTotal > 0 ? <ol className="my-3 space-y-2">{concentrationRows.map(row => <li key={row.key ?? 'others'} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_3rem] items-center gap-3 text-xs">
          {row.key ? <button type="button" title={row.label} className="truncate text-left text-slate-700 hover:text-blue-700 hover:underline" onClick={() => onDrill({ kind: 'orders', basis: 'lorenz', customerKey: row.key! })}>{row.label}</button> : <span className="text-slate-500">{row.label}</span>}
          <div className="h-2.5" aria-hidden="true"><div className="h-full rounded-sm bg-slate-500" style={{ width: (row.value / largestShare * 100) + '%' }} /></div>
          <span className="text-right tabular-nums text-slate-600">{percent(row.value / customerTotal)}</span>
        </li>)}</ol> : <p className="flex min-h-32 flex-1 items-center text-xs text-slate-500">Ni povezanih strank z znano pozitivno vrednostjo plačanih naročil.</p>}
        <p className="mt-auto text-[10px] leading-4 text-slate-500">Brez povezane identitete: {numeric(data.customers.unlinkedOrders, 0)} naročil. Iz povezanih naročil zaradi neuporabne vrednosti izključeno: {numeric(Math.max(0, data.customers.linkedOrders - customers.reduce((sum, customer) => sum + customer.orders, 0)), 0)}.</p>
        <button type="button" className="mt-2 self-start text-xs text-blue-700 underline" onClick={() => onNavigate('stranke')}>Vse stranke in Lorenzova krivulja ↗</button>
      </article>
    </div>
    <div className="grid items-start gap-3 xl:grid-cols-2">{children}</div>
  </div>;
}
