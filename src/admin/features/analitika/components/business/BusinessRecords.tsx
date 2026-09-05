'use client';

import { useEffect, useRef, useState } from 'react';
import type { BusinessDrilldownResponse } from '@/shared/domain/analytics/businessAnalytics';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { getStatusLabel } from '@/shared/domain/order/orderStatus';
import { DataTable, eur, numeric, type Drill } from './BusinessChart';


function drillLabel(key: string, value: string): string {
  const labels: Record<string, string> = { kind: 'Zapisi', basis: 'Osnova', date: 'Datum', customerType: 'Tip naročnika', source: 'Izvor', status: 'Status', min: 'Spodnja meja', max: 'Zgornja meja', inclusiveMax: 'Vključena zgornja meja', customerKey: 'Naročnik', orderId: 'ID naročila', productKey: 'Artikel', cohort: 'Kohorta', cohortMonth: 'Mesec kohorte', topCustomerCount: 'Prvih naročnikov', lorenzPopulation: 'Delež naročnikov', municipalityId: 'Občina', regionId: 'Regija' };
  const values: Record<string, string> = { orders: 'Naročila', quotes: 'Ponudbe', activity: 'Oddana naročila', realised: 'Realizirana naročila', lorenz: 'Realizirano blago pred vračili', weight: 'Dejanska masa (kg)', response: 'Odzivni čas (ure)', decision: 'Čas do sprejema (ure)', direct: 'Neposredno', quote: 'Iz ponudbe', true: 'Da', false: 'Ne', unknown: 'Neznano' };
  const shown = key === 'customerType' && value !== 'unknown' ? getCustomerTypeLabel(value) : key === 'status' ? getStatusLabel(value) : values[value] ?? value;
  return (labels[key] ?? key) + ': ' + shown;
}

export default function BusinessRecords({ query, drill, onClose }: { query: string; drill: Drill; onClose: () => void }) {
  const [data, setData] = useState<BusinessDrilldownResponse | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const params = new URLSearchParams(query); Object.entries(drill).forEach(([key, value]) => params.set(key, value)); params.set('page', String(page));
  const key = params.toString();
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    fetch('/api/admin/analytics/business/records?' + key, { signal: controller.signal, cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('Pripadajočih zapisov ni mogoče naložiti.'); return response.json() as Promise<BusinessDrilldownResponse>; }).then(setData).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [key]);
  return <dialog ref={dialog} onCancel={onClose} className="m-auto max-h-[90vh] w-[min(1000px,95vw)] rounded-2xl border border-slate-200 p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
    <div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Pripadajoči {drill.kind === 'quotes' ? 'ponudbeni primeri' : 'zapisi naročil'}</h2><p className="mt-1 text-xs text-slate-500">Enaka populacija in filtri kot izbrani graf.</p></div><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Zapri</button></div>
    <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-600">{Object.entries(drill).map(([key, value]) => <span key={key} className="rounded bg-slate-100 px-2 py-1">{drillLabel(key, value)}</span>)}</div>
    {error ? <p role="alert" className="py-8 text-sm text-red-700">{error}</p> : !data ? <p role="status" className="py-8 text-sm text-slate-500">Nalaganje zapisov …</p> : <>
      <DataTable columns={['Številka', 'Datum', 'Naročnik', 'Tip', 'Status', 'Izvor', data?.valueUnit === 'h' ? 'Čas (ure)' : data?.valueUnit === 'kg' ? 'Dejanska masa (kg)' : 'Vrednost brez DDV (EUR)']} rows={data.records.map(record => ({ href: record.href, values: [record.number, new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', dateStyle: 'medium' }).format(new Date(record.date)), record.customerName, record.customerType === 'unknown' ? 'Neznano' : getCustomerTypeLabel(record.customerType), drill.kind === 'quotes' ? ({ issued: 'Izdana', accepted: 'Sprejeta', ordered: 'Naročena', declined: 'Zavrnjena', expired: 'Potekla', preparation: 'V pripravi', received: 'Prejeta' }[record.status] ?? record.status) : getStatusLabel(record.status), record.source === 'quote' ? 'Iz ponudbe' : 'Neposredno', data.valueUnit === 'h' || data.valueUnit === 'kg' ? numeric(record.value) + ' ' + data.valueUnit : eur(record.value)] }))} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"><span>{data.total} zapisov · stran {data.page}</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-30">Prejšnja</button><button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="disabled:opacity-30">Naslednja</button><a href={'/api/admin/analytics/business/records?' + key + '&format=csv'} className="text-blue-700 underline">Izvozi vse ujemajoče zapise CSV</a></div></div>
    </>}
  </dialog>;
}
