'use client';

import { formatAnalyticsCalendarDay as shortDate } from '../lib/formatting';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { formatEuroAmount, formatEuroWithSuffix, formatSlCount, formatSlInteger } from '@/shared/domain/formatting';
import { addCalendarDays } from '@/shared/domain/analytics/period';
import { readAnalyticsJson } from '@/shared/client/readAnalyticsJson';
import type { BusinessActivityResponse } from '@/shared/domain/analytics/activity';
import BusinessRecords from './business/BusinessRecords';
import styles from './AdminOrdersActivityHeatmap.module.css';
import AdminPeriodSelector from '@/shared/ui/admin-period-selector';
import { adminAnalyticsPanelClassName } from '@/shared/ui/theme/tokens';

type Mode = 'orders' | 'revenue';
type Day = BusinessActivityResponse['days'][number];
const colors = ['#e5e7eb', '#86efac', '#2dd4bf', '#38bdf8', '#6366f1', '#6d28d9'];
const compactColors = ['#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#334155'];
const countBands = ['1–2', '3–5', '6–10', '11–14', '15+'];
const valueBands = ['< 20,00 €', '20,00–< 50,00 €', '50,00–< 100,00 €', '100,00–< 250,00 €', '≥ 250,00 €'];
const weekdays = ['P', 'T', 'S', 'Č', 'P', 'S', 'N'];
const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'avg.', 'sep.', 'okt.', 'nov.', 'dec.'];
const dayDate = (date: string) => new Date(date + 'T12:00:00Z');
const fullDate = (date: string) => date.split('-').reverse().join('.');
const countLevel = (value: number | null) => value == null || value <= 0 ? 0 : value <= 2 ? 1 : value <= 5 ? 2 : value <= 10 ? 3 : value < 15 ? 4 : 5;
const knownCount = (day: Day) => day.available ? day.orderCount : null;
const knownValue = (day: Day) => day.available && day.valueCount === day.orderCount ? day.activityValue : null;
const valueLevel = (value: number | null) => value == null || value <= 0 ? 0 : value < 20 ? 1 : value < 50 ? 2 : value < 100 ? 3 : value < 250 ? 4 : 5;
const dayDescription = (day: Day) => `${fullDate(day.date)} | ${knownCount(day) == null ? '—' : formatSlInteger(day.orderCount)} nar. | ${knownValue(day) == null ? '—' : formatEuroAmount(day.activityValue) + '€'}`;

export default function AdminOrdersActivityHeatmap({
  customerType = 'all', status = 'all', source = 'all', entrySource = 'all', history = 'all', compact = false
}: { customerType?: string; status?: string; source?: string; entrySource?: string; history?: string; compact?: boolean }) {
  const palette = compact ? compactColors : colors;
  const calendar = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 0, weeks: 0 });
  const [mode, setMode] = useState<Mode>('orders');
  const [result, setResult] = useState<{ query: string; data: BusinessActivityResponse } | null>(null);
  const [failure, setFailure] = useState<{ query: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);
  const [tabDate, setTabDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; query: string } | null>(null);
  const requestedWeeks = compact ? 52 : layout.weeks;
  const query = new URLSearchParams({ weeks: String(requestedWeeks), customerType, status, source, entrySource, history }).toString();

  useEffect(() => {
    const element = calendar.current;
    if (!element) return;
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      // 22 px weekday rail + 8 px gutter, then readable 16 px squares and 4 px gaps.
      const weeks = Math.max(1, Math.min(520, Math.floor((width - 30 + 4) / 20)));
      setLayout(previous => previous.width === width && previous.weeks === weeks ? previous : { width, weeks });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!requestedWeeks) return;
    const controller = new AbortController();
    setFailure(null);
    fetch('/api/admin/analytics/business/activity?' + query, { cache: 'no-store', signal: controller.signal })
      .then(response => readAnalyticsJson<BusinessActivityResponse>(response, 'Zgodovina aktivnosti ni na voljo.'))
      .then(data => { if (!controller.signal.aborted) setResult({ query, data }); })
      .catch(error => { if (!controller.signal.aborted) setFailure({ query, message: error.message }); });
    return () => controller.abort();
  }, [query, retry, requestedWeeks]);

  const data = result?.query === query ? result.data : null;
  const error = failure?.query === query ? failure.message : null;
  const model = useMemo(() => {
    const byDate = new Map(data?.days.map(day => [day.date, day]) ?? []);
    const weeks = Array.from({ length: data?.weeks ?? 0 }, (_, index) => {
      const start = addCalendarDays(data!.from, index * 7);
      return { start, dates: Array.from({ length: 7 }, (_, offset) => addCalendarDays(start, offset)) };
    });
    return { byDate, weeks };
  }, [data]);
  const displayedWeeks = data?.weeks ?? requestedWeeks;
  // Compact history is fixed; reserve a readable 12px cell and scroll narrower viewports.
  // The compact calendar's 2px margin keeps keyboard focus outlines inside the scroller.
  const calendarWidth = compact
    ? Math.max(layout.width - 4, 30 + displayedWeeks * 12 + Math.max(0, displayedWeeks - 1) * 4)
    : layout.width;
  const cellSize = data ? Math.max(1, (calendarWidth - 30 - (data.weeks - 1) * 4) / data.weeks) : 16;
  const gridStyle = { '--activity-cell': cellSize + 'px', '--activity-cell-height': (compact ? 11 : cellSize) + 'px', '--activity-weeks': displayedWeeks, '--activity-calendar-width': calendarWidth + 'px' } as CSSProperties;
  const monthLabels: Array<{ date: string; label: string; left: number }> = [];
  let previousRight = -8;
  model.weeks.forEach((week, index) => {
    const end = addCalendarDays(week.start, 6);
    const date = dayDate(data && end > data.to ? data.to : end);
    const before = dayDate(addCalendarDays(week.start, -1));
    if (index !== 0 && date.getUTCMonth() === before.getUTCMonth()) return;
    const year = index === 0 || date.getUTCFullYear() !== before.getUTCFullYear();
    const label = months[date.getUTCMonth()] + (year ? ' ' + date.getUTCFullYear() : '');
    const left = index * (cellSize + 4), estimatedWidth = label.length * 6;
    if (left < previousRight + 8 || left + estimatedWidth > calendarWidth - 30) return;
    monthLabels.push({ date: week.start, label, left }); previousRight = left + estimatedWidth;
  });
  const recordParams = data ? new URLSearchParams({
    range: 'custom', from: data.from, to: data.to, asOf: data.asOf,
    customerType: data.filters.customerType, status: data.filters.status, source: data.filters.source, entrySource: data.filters.entrySource ?? 'all', history: data.filters.history ?? 'all'
  }) : null;
  const recordQuery = recordParams?.toString() ?? '';
  const detail = model.byDate.get(focused ?? selected?.date ?? '');
  const navigateDay = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const shifts: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    const next = event.key === 'Home' ? data?.from : event.key === 'End' ? data?.to : event.key in shifts ? addCalendarDays(date, shifts[event.key]) : null;
    if (!next) return;
    event.preventDefault();
    if (!model.byDate.has(next)) return;
    setTabDate(next);
    calendar.current?.querySelector<HTMLButtonElement>('[data-date="' + next + '"]')?.focus();
  };

  const modeSelector = <AdminPeriodSelector value={mode} onChange={value => setMode(value as Mode)} ariaLabel="Mera aktivnosti" options={[{ value: 'orders', label: 'Naročila' }, { value: 'revenue', label: 'Vrednost naročil' }]} />;

  return <article data-testid="order-activity-heatmap" data-compact={compact || undefined} className={'relative w-full ' + (compact ? 'min-w-0 !p-3 ' : '') + adminAnalyticsPanelClassName}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className={compact ? 'min-w-0' : 'flex flex-wrap items-center gap-3'}>
        <h2 className="text-sm font-semibold text-slate-950">{compact ? 'Aktivnost oddanih naročil' : 'Aktivnost naročil'}</h2>
        {compact ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Zadnjih 52 tednov{data && <> · {shortDate(data.from)} – {shortDate(data.to)}</>}</p> : modeSelector}
      </div>
      <div className={compact ? 'ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1' : 'contents'}>
        {compact && modeSelector}
        {data && <a href={'/api/admin/analytics/business/records?' + recordQuery + '&kind=orders&format=csv'} className="text-xs font-medium text-blue-700 underline underline-offset-4">Izvoz CSV</a>}
      </div>
    </div>
    {!compact && <>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">Zgodovina se prilagaja širini koledarja, ne izbiri obdobja zgoraj. Filtri tipa naročnika, statusa in izvora veljajo. Oddana naročila vključujejo pozneje preklicana; vrednosti blaga so brez DDV in poštnine.</p>
      {data && <p className="mt-2 text-[11px] text-slate-500">{shortDate(data.from)} – {shortDate(data.to)} · {formatSlCount(data.weeks, { one: 'teden', two: 'tedna', few: 'tedni', other: 'tednov' })}</p>}
    </>}
    <div ref={calendar} className={compact ? 'mt-2 w-full min-w-0 overflow-x-auto' : 'mt-4 w-full min-w-0'} role="region" aria-label="Koledar aktivnosti naročil" style={gridStyle}>
      {error ? <div role="alert" className={(compact ? "min-h-[109px] " : "min-h-40 ") + "flex flex-wrap items-center gap-2 text-xs text-red-700"}>{error}<button className="underline" onClick={() => setRetry(value => value + 1)}>Poskusi znova</button></div>
        : !data ? <p role="status" className={(compact ? "min-h-[109px] " : "min-h-40 ") + "flex items-center text-xs text-slate-500"}>Nalaganje zgodovine aktivnosti …</p>
          : <div className={styles.calendar + (compact ? ' ' + styles.compactCalendar : '')}>
            <div />
            <div className={compact ? "relative h-4" : "relative h-6"}>{monthLabels.map(month => <span key={month.date} className="absolute whitespace-nowrap text-[10px] text-slate-500" style={{ left: month.left }}>{month.label}</span>)}</div>
            <div className={styles.week} aria-hidden="true">{weekdays.map((day, index) => <span key={index} className="flex items-center text-[10px] text-slate-400">{day}</span>)}</div>
            <div data-testid="activity-calendar-grid" data-weeks={data.weeks} className={styles.weeks}>
              {model.weeks.map(week => <div key={week.start} className={styles.week}>
                {week.dates.map(date => {
                  const day = model.byDate.get(date);
                  if (!day) return <span key={date} aria-hidden="true" />;
                  const value = mode === 'orders' ? knownCount(day) : knownValue(day);
                  const level = mode === 'orders' ? countLevel(value) : valueLevel(value);
                  return <button key={date} type="button" className={styles.day}
                    data-date={date} data-count-level={countLevel(knownCount(day))} data-value-level={valueLevel(knownValue(day))}
                    style={{ '--activity-color': palette[level] } as CSSProperties}
                    aria-label={dayDescription(day)} title={dayDescription(day)} aria-pressed={selected?.date === date}
                    tabIndex={date === (tabDate && model.byDate.has(tabDate) ? tabDate : data.to) ? 0 : -1}
                    onKeyDown={event => navigateDay(event, date)}
                    onMouseEnter={() => setFocused(date)} onMouseLeave={() => setFocused(null)}
                    onFocus={() => { setTabDate(date); setFocused(date); }} onBlur={() => setFocused(null)}
                    onClick={() => setSelected({ date, query: recordQuery })} />;
                })}
              </div>)}
            </div>
          </div>}
    </div>
    <div className={compact ? "mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1" : "contents"}>
      <div className={compact ? "flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-slate-500" : "mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500"} aria-label={mode === 'orders' ? 'Legenda: število naročil' : 'Legenda: vrednost naročil'}>
        <span className="inline-flex items-center gap-1.5"><i className={compact ? "h-2.5 w-2.5 rounded-[2px]" : "h-3 w-3 rounded-[2px]"} style={{ backgroundColor: palette[0] }} />0 / brez podatka</span>
        {(mode === 'orders' ? countBands : valueBands).map((label, index) => <span key={label} className="inline-flex items-center gap-1.5"><i className={compact ? "h-2.5 w-2.5 rounded-[2px]" : "h-3 w-3 rounded-[2px]"} style={{ backgroundColor: palette[index + 1] }} />{label}</span>)}
      </div>
      <p className={compact ? 'sr-only' : 'mt-3 min-h-4 text-xs text-slate-600'} aria-live="polite">{detail ? dayDescription(detail) : compact ? 'Izberite dan za pregled. Puščice premikajo izbiro.' : 'Izberite dan za pregled naročil. Po koledarju se lahko premikate s puščicami.'}</p>
      {compact && <details className="text-[11px] leading-4 text-slate-500 open:w-full">
        <summary className="cursor-pointer">Obseg podatkov</summary>
        <p className="mt-1">Zadnjih 52 koledarskih tednov vključuje tekoči teden do danes in je neodvisnih od obdobja poročila. Veljajo filtri tipa naročnika, statusa in izvora. To je aktivnost oddanih naročil, ne samo plačanih; vključuje pozneje preklicana naročila. Vrednosti blaga so brez DDV in poštnine. Izberite dan za pregled naročil; po koledarju se lahko premikate s puščicami.</p>
      </details>}
      {data && <details className={compact ? 'text-[11px] leading-4 text-slate-500 open:w-full' : 'mt-2 text-xs text-slate-500'}><summary className="cursor-pointer">Dostopna tabela po dnevih</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Datum</th><th>Naročila</th><th>Vrednost blaga brez DDV in poštnine</th></tr></thead><tbody>{data.days.map(day => <tr key={day.date} className="border-t border-slate-100"><td className="p-2"><button className="text-blue-700 underline" onClick={() => setSelected({ date: day.date, query: recordQuery })}>{fullDate(day.date)}</button></td><td>{knownCount(day) == null ? '—' : formatSlInteger(day.orderCount)}</td><td>{knownValue(day) == null ? '—' : formatEuroWithSuffix(day.activityValue)}</td></tr>)}</tbody></table></div></details>}
    </div>
    {selected && <BusinessRecords key={selected.date + selected.query} query={selected.query} drill={{ kind: 'orders', date: selected.date }} onClose={() => setSelected(null)} />}
  </article>;
}
