'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import { Spinner } from '@/shared/ui/loading';
import type { AnalyticsMeasurementFields } from '@/shared/domain/analytics/measurements';

type MeasurementResponse = {
  orderId: string;
  orderNumber: string;
  revision: number;
  measuredAt: string | null;
  measuredBy: string | null;
  fields: Record<keyof AnalyticsMeasurementFields, string | number | boolean | null>;
  history?: Array<{ revision: number; changed_at: string; actor_id: string; reason: string }>;
};
const numericFields = [
  ['actualPackedWeightGrams', 'Dejanska masa zapakiranega naročila', 'g'],
  ['actualCarrierCostNet', 'Dejanski strošek prevoznika brez DDV', 'EUR'],
  ['actualParcelCount', 'Dejansko število paketov', 'paketov'],
  ['preparationMinutes', 'Dejansko delo pri pripravi in pakiranju', 'min'],
  ['actualLengthMm', 'Izmerjena dolžina paketa', 'mm'],
  ['actualWidthMm', 'Izmerjena širina paketa', 'mm'],
  ['actualHeightMm', 'Izmerjena višina paketa', 'mm'],
  ['shippingTaxRate', 'Potrjena stopnja DDV za zaračunano poštnino', '0–1'],
  ['merchandiseRefundNet', 'Skupaj potrjena vračila blaga brez DDV', 'EUR']
] as const;
const textControl = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-blue-600';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50';
const time = (value: string) => new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function BusinessMeasurements({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [orderId, setOrderId] = useState('');
  const [record, setRecord] = useState<MeasurementResponse | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean | null>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    return () => pending.current?.abort();
  }, []);
  const assign = (payload: MeasurementResponse) => {
    setRecord(payload);
    setValues(Object.fromEntries(Object.entries(payload.fields).map(([key, value]) => [key, typeof value === 'boolean' || value === null ? value : String(value)])));
  };
  const load = async (event: FormEvent) => {
    event.preventDefault();
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setNotice(''); setRecord(null); setReason('');
    try {
      const response = await fetch('/api/admin/analytics/orders/' + encodeURIComponent(orderId.trim()) + '/measurements', { signal: controller.signal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Meritev ni mogoče naložiti.');
      if (!controller.signal.aborted) assign(payload);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Meritev ni mogoče naložiti.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!record) return;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setNotice('');
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]));
    try {
      const response = await fetch('/api/admin/analytics/orders/' + record.orderId + '/measurements', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: record.revision, reason, fields })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Meritev ni mogoče shraniti.');
      if (!controller.signal.aborted) {
        assign(payload); setReason(''); setNotice('Meritve so shranjene. Analitika je osvežena.'); onSaved();
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Meritev ni mogoče shraniti.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const update = (key: string, value: string | boolean | null) => setValues(current => ({ ...current, [key]: value }));
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="analytics-measurements-title" className="m-auto max-h-[92vh] w-[min(720px,95vw)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
    <div className="flex items-start justify-between gap-3"><div><h2 id="analytics-measurements-title" className="text-lg font-semibold">Dejanske meritve naročila</h2><p className="mt-1 max-w-lg text-xs leading-5 text-slate-600">Prazno polje pomeni »Manjka podatek«. Vnesite izmerjene vrednosti in vir. Meritve ne spreminjajo obračunane poštnine ali pravil cenika.</p></div><button type="button" className={button} onClick={onClose}>Zapri</button></div>
    <form onSubmit={load} className="mt-4 flex items-end gap-3">
      <label className="flex-1 text-xs font-medium">ID naročila<input autoFocus required pattern="[1-9][0-9]*" inputMode="numeric" value={orderId} onChange={event => setOrderId(event.target.value)} className={textControl + ' mt-1'} placeholder="ID iz povezave naročila" /></label>
      <button type="submit" className={button} disabled={busy}>Naloži</button>
    </form>
    {busy && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Spinner size="sm" /> Obdelava …</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {record && <form onSubmit={save} className="mt-5 space-y-5">
      <div className="flex flex-wrap justify-between gap-2 text-xs"><a href={'/admin/orders/' + record.orderId} className="font-semibold text-blue-700 underline">Naročilo {record.orderNumber}</a><span className="text-slate-500">Revizija {record.revision}{record.measuredAt ? ' · ' + time(record.measuredAt) : ' · Brez vnesenih meritev'}</span></div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{numericFields.map(([key, label, unit]) => <label key={key} className="block text-xs font-medium leading-5">{label}<AdminUnitInput unit={unit} inputMode="decimal" value={String(values[key] ?? '')} placeholder="Manjka podatek" onChange={event => update(key, event.target.value)} className="mt-1 w-full" inputClassName="h-9 text-sm" /></label>)}
        <label className="block text-xs font-medium leading-5">Presežne mere<select className={textControl + ' mt-1'} value={values.actualOversize === null ? '' : String(values.actualOversize ?? '')} onChange={event => update('actualOversize', event.target.value === '' ? null : event.target.value === 'true')}><option value="">Manjka podatek</option><option value="false">Ne</option><option value="true">Da</option></select></label>
      </div>
      <p className="text-xs leading-5 text-slate-500">Čas pomeni minute aktivnega dela, ne starosti naročila. Mere opisujejo izmerjeni paket; pri več paketih so le operativna opomba, simulacija uporabi zgodovinske postavke. Stopnja DDV 22 % se vpiše kot 0,22.</p>
      <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={values.refundHistoryComplete === true} onChange={event => update('refundHistoryComplete', event.target.checked)} />Potrjujem, da znesek vključuje vsa doslej evidentirana vračila blaga za to naročilo. Če vračil ni, vpišite 0.</label>
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Potrjena identiteta naročnika in testni zapisi</summary><p className="mt-2 text-xs leading-5 text-slate-500">Povežite le preverjeno stranko oziroma točno šolsko enoto. Skupni sedež ali podoben naziv nista dokaz iste enote. ID šolske vrstice ne potrjuje občine brez ujemanja naslova.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">ID trajnega zapisa stranke<input value={String(values.customerDirectoryProfileId ?? '')} onChange={event => update('customerDirectoryProfileId', event.target.value)} className={textControl + ' mt-1'} placeholder="Brez povezave" /></label><label className="text-xs">ID šole oziroma enote<input value={String(values.schoolDirectoryRowId ?? '')} onChange={event => update('schoolDirectoryRowId', event.target.value)} className={textControl + ' mt-1'} placeholder="Brez povezave" /></label></div><label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={values.analyticsIsTest === true} onChange={event => update('analyticsIsTest', event.target.checked)} />Testno naročilo – izključi iz poslovnih kazalnikov</label></details>
      <label className="block text-xs font-medium">Vir meritev oziroma razlog popravka<textarea required minLength={3} maxLength={2000} rows={2} className={textControl + ' mt-1'} value={reason} onChange={event => setReason(event.target.value)} placeholder="Npr. račun prevoznika, tehtanje, časovnica priprave …" /></label>
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Vsak popravek se shrani z revizijo in skrbnikom.</span><button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40" type="submit">Shrani meritve</button></div>
      {!!record.history?.length && <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs font-medium">Zadnjih {record.history.length} popravkov</summary><ol className="mt-2 space-y-2 text-xs">{record.history.map(entry => <li key={entry.revision}><span className="text-slate-500">#{entry.revision} · {time(entry.changed_at)} · {entry.actor_id}</span><p className="mt-1">{entry.reason}</p></li>)}</ol></details>}
    </form>}
  </dialog>;
}
