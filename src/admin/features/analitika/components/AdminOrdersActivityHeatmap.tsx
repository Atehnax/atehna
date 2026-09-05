'use client';

import { useMemo, useState } from 'react';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';

export type AdminOrdersHeatmapDay = {
  date: string;
  order_count: number | null;
  revenue_total: number | null;
  available?: boolean;
  partial?: boolean;
};
type Mode = 'orders' | 'revenue';
const colors = ['#f1f5f9', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#16a34a'];
const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'avg.', 'sep.', 'okt.', 'nov.', 'dec.'];
const weekdays = ['P', 'T', 'S', 'Č', 'P', 'S', 'N'];
const dayDate = (key: string) => new Date(`${key}T12:00:00Z`);
const shift = (key: string, amount: number) => {
  const date = dayDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const fullDate = (key: string) => new Intl.DateTimeFormat('sl-SI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dayDate(key));

export default function AdminOrdersActivityHeatmap({
  days, onSelectDay, exportHref
}: {
  days: readonly AdminOrdersHeatmapDay[];
  onSelectDay?: (date: string) => void;
  exportHref?: string;
}) {
  const [mode, setMode] = useState<Mode>('orders');
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const model = useMemo(() => {
    const ordered = [...days].sort((left, right) => left.date.localeCompare(right.date));
    if (!ordered.length) return { weeks: [] as Array<{ start: string; label: string; dates: string[] }>, byDate: new Map<string, AdminOrdersHeatmapDay>(), maximum: 0, singleValue: false };
    const first = ordered[0].date;
    const last = ordered[ordered.length - 1].date;
    const start = shift(first, -((dayDate(first).getUTCDay() + 6) % 7));
    const byDate = new Map(ordered.map(day => [day.date, day]));
    const maximum = Math.max(0, ...ordered.filter(day => day.available !== false).map(day => (mode === 'orders' ? day.order_count : day.revenue_total) ?? 0));
    const weeks: Array<{ start: string; label: string; dates: string[] }> = [];
    let lastLabelWeek = -4;
    for (let current = start, index = 0; current <= last; current = shift(current, 7), index++) {
      const weekEnd = shift(current, 6);
      const date = dayDate(weekEnd < last ? weekEnd : last);
      const previous = dayDate(shift(current, -1));
      const changedMonth = date.getUTCMonth() !== previous.getUTCMonth();
      const shouldLabel = index === 0 || (changedMonth && index - lastLabelWeek >= 3);
      const showYear = index === 0 || date.getUTCFullYear() !== previous.getUTCFullYear();
      weeks.push({
        start: current,
        label: shouldLabel ? `${months[date.getUTCMonth()]}${showYear ? ' ' + date.getUTCFullYear() : ''}` : '',
        dates: Array.from({ length: 7 }, (_, offset) => shift(current, offset))
      });
      if (shouldLabel) lastLabelWeek = index;
    }
    const singleValue = new Set(ordered.filter(day => day.available !== false).map(day => mode === 'orders' ? day.order_count : day.revenue_total).filter(value => value != null && value > 0)).size === 1;
    return { weeks, byDate, maximum, singleValue };
  }, [days, mode]);
  const detail = model.byDate.get(focused ?? selected ?? '');
  const thresholds = model.maximum > 0 ? model.singleValue ? [model.maximum] : Array.from({ length: 5 }, (_, index) => model.maximum * (index + 1) / 5) : [];
  const metric = mode === 'orders' ? 'naročil' : 'EUR brez DDV in poštnine';

  return (
    <article className="relative w-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-950">Aktivnost naročil</h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label="Mera aktivnosti">
            {([{ value: 'orders', label: 'Naročila' }, { value: 'revenue', label: 'Vrednost naročil' }] as const).map(option =>
              <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => setMode(option.value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-green-700 ${mode === option.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{option.label}</button>
            )}
          </div>
        </div>
        {exportHref && <a href={exportHref} className="text-xs font-medium text-blue-700 underline underline-offset-4">Izvoz CSV</a>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Oddana naročila, tudi pozneje preklicana. Vrednost blaga po popustih, brez DDV in poštnine. Robovi zunaj obdobja ostanejo prazni; današnji dan je delen, kadar je vključen.</p>
      {!model.weeks.length ? <p className="py-8 text-sm text-slate-500">Ni opazovanj za izbrano obdobje.</p> :
      <div className="mt-4 overflow-x-auto pb-2" role="region" aria-label="Koledar aktivnosti, vodoravno pomikanje za daljša obdobja" tabIndex={0}>
        <div className="grid w-max grid-cols-[22px_1fr] gap-x-2">
          <div />
          <div className="relative h-7" style={{ width: model.weeks.length * 24 }}>
            {model.weeks.map((week, index) => week.label && <span key={week.start} className="absolute whitespace-nowrap text-[11px] text-slate-500" style={{ left: index * 24 }}>{week.label}</span>)}
          </div>
          <div className="grid gap-1" style={{ gridTemplateRows: 'repeat(7, 20px)' }} aria-hidden="true">
            {weekdays.map((day, index) => <span key={index} className="flex items-center text-[11px] text-slate-400">{day}</span>)}
          </div>
          <div className="flex gap-1">
            {model.weeks.map(week => <div key={week.start} className="grid gap-1" style={{ gridTemplateRows: 'repeat(7, 20px)' }}>
              {week.dates.map(date => {
                const day = model.byDate.get(date);
                const value = mode === 'orders' ? day?.order_count : day?.revenue_total;
                const unavailable = day?.available === false || value == null;
                const level = !value || value <= 0 || !model.maximum ? 0 : Math.min(5, Math.max(1, Math.ceil(value / model.maximum * 5)));
                if (!day) return <span key={date} className="h-5 w-5" aria-hidden="true" />;
                const label = `${fullDate(date)}: ${day.order_count == null ? 'število ni na voljo' : formatSlInteger(day.order_count) + ' naročil'}, ${day.revenue_total == null ? 'vrednost ni na voljo' : formatEuroWithSuffix(day.revenue_total)}${day.partial ? ', delen dan' : ''}`;
                return <button key={date} type="button" aria-label={label} title={label} aria-pressed={selected === date} onMouseEnter={() => setFocused(date)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(date)} onBlur={() => setFocused(null)} onClick={() => { setSelected(date); onSelectDay?.(date); }} className={`h-5 w-5 rounded-[4px] border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-800 ${selected === date ? 'border-slate-800' : day.partial ? 'border-green-700' : 'border-transparent'}`} style={{ backgroundColor: unavailable ? '#e2e8f0' : colors[level], backgroundImage: unavailable ? 'repeating-linear-gradient(135deg,transparent,transparent 3px,#94a3b8 3px,#94a3b8 4px)' : undefined }} />;
              })}
            </div>)}
          </div>
        </div>
      </div>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500" aria-label={`Legenda: ${metric}`}>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-slate-100" />0 {metric}</span>
        {thresholds.map((threshold, index) => <span key={index} className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[model.singleValue ? 5 : index + 1] }} />≤ {new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(threshold)}</span>)}
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 border border-slate-400 bg-slate-200" />Nerazpoložljivo / nepopolna zgodovina</span>
      </div>
      <p className="mt-3 min-h-4 text-xs text-slate-600" aria-live="polite">{detail ? `${fullDate(detail.date)} · ${detail.order_count == null ? 'Število ni na voljo' : formatSlInteger(detail.order_count) + ' naročil'} · ${detail.revenue_total == null ? 'Vrednost ni na voljo' : formatEuroWithSuffix(detail.revenue_total)}${detail.partial ? ' · Delen dan' : ''}` : 'Izberite dan za pregled pripadajočih naročil.'}</p>
      <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Dostopna tabela po dnevih</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Datum</th><th>Naročila</th><th>Vrednost blaga brez DDV in poštnine</th></tr></thead><tbody>{days.map(day => <tr key={day.date} className="border-t border-slate-100"><td className="p-2"><button className="text-blue-700 underline" onClick={() => onSelectDay?.(day.date)}>{fullDate(day.date)}{day.partial ? ' (delno)' : ''}</button></td><td>{day.order_count == null ? 'Ni na voljo' : formatSlInteger(day.order_count)}</td><td>{day.revenue_total == null ? 'Manjka podatek' : formatEuroWithSuffix(day.revenue_total)}</td></tr>)}</tbody></table></div></details>
    </article>
  );
}
