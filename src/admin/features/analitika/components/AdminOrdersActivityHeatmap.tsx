'use client';

import { useMemo, useRef, useState } from 'react';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';

type HeatmapMode = 'orders' | 'revenue';

export type AdminOrdersHeatmapDay = {
  date: string;
  order_count: number;
  revenue_total: number;
};

type HeatmapDay = {
  date: Date;
  dateKey: string;
  orderCount: number;
  revenue: number;
  level: number;
};

type HeatmapWeek = {
  label: string;
  days: HeatmapDay[];
};

type HoverState = {
  day: HeatmapDay;
  left: number;
  top: number;
};

const weekCount = 71;
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const colors = ['#eef2f7', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'];
const heatmapCellSize = 14;
const heatmapGapSize = 2;

const pad2 = (value: number) => String(value).padStart(2, '0');

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const shiftDateByDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeekMonday = (date: Date) => {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
};

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseYmd = (value: string) => startOfLocalDay(new Date(`${value}T00:00:00`));

const formatDate = (date: Date) => toDateKey(date);

const formatInt = formatSlInteger;
const formatCurrency = formatEuroWithSuffix;

const buildWeeks = (days: readonly AdminOrdersHeatmapDay[], mode: HeatmapMode): HeatmapWeek[] => {
  const parsedDays = days
    .map((day) => {
      const date = parseYmd(day.date);
      if (Number.isNaN(date.getTime())) return null;
      return {
        date,
        dateKey: toDateKey(date),
        orderCount: Number.isFinite(day.order_count) ? day.order_count : 0,
        revenue: Number.isFinite(day.revenue_total) ? day.revenue_total : 0
      };
    })
    .filter((day): day is Omit<HeatmapDay, 'level'> => day !== null);

  const today = startOfLocalDay(new Date());
  const endDate = today;
  const endTime = endDate.getTime();
  const firstWeekStart = shiftDateByDays(startOfWeekMonday(endDate), -(weekCount - 1) * 7);
  const sourceByDate = new Map(parsedDays.map((day) => [day.dateKey, day]));

  const values: number[] = [];
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekStart = shiftDateByDays(firstWeekStart, weekIndex * 7);
    const previousWeekStart = weekIndex > 0 ? shiftDateByDays(firstWeekStart, (weekIndex - 1) * 7) : null;
    const label =
      weekIndex === 0 || previousWeekStart?.getMonth() !== weekStart.getMonth()
        ? monthLabels[weekStart.getMonth()]
        : '';
    const weekDays = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = shiftDateByDays(weekStart, dayIndex);
      const dateKey = toDateKey(date);
      const source = sourceByDate.get(dateKey);
      return {
        date,
        dateKey,
        orderCount: source?.orderCount ?? 0,
        revenue: source?.revenue ?? 0,
        level: 0
      };
    }).filter((day) => {
      const isVisible = day.date.getTime() <= endTime;
      if (!isVisible) return false;
      values.push(mode === 'orders' ? day.orderCount : day.revenue);
      return true;
    });
    return { label, days: weekDays };
  });
  const maxValue = Math.max(...values, 0);

  return weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      const value = mode === 'orders' ? day.orderCount : day.revenue;
      return {
        ...day,
        level: value <= 0 || maxValue <= 0 ? 0 : Math.max(1, Math.ceil((value / maxValue) * 5))
      };
    })
  }));
};

export default function AdminOrdersActivityHeatmap({ days }: { days: readonly AdminOrdersHeatmapDay[] }) {
  const [mode, setMode] = useState<HeatmapMode>('orders');
  const [hover, setHover] = useState<HoverState | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const weeks = useMemo(() => buildWeeks(days, mode), [days, mode]);

  const showHover = (day: HeatmapDay, target: HTMLSpanElement) => {
    const root = rootRef.current?.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (!root) return;
    setHover({
      day,
      left: rect.left - root.left + rect.width / 2,
      top: rect.top - root.top - 8
    });
  };

  return (
    <article
      ref={rootRef}
      className="relative mb-4 w-full rounded-[14px] border border-slate-200 bg-white px-6 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_30px_rgba(15,23,42,0.05)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-[17px] font-semibold leading-none text-slate-950">Aktivnost naročil</h2>
          <div className="inline-flex h-8 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[
              { value: 'orders', label: 'Naročila' },
              { value: 'revenue', label: 'Prihodki' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value as HeatmapMode)}
                className={`rounded-md px-3.5 text-[13px] font-semibold transition ${
                  mode === option.value
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium leading-none text-slate-500">
          <span>Ni podatkov</span>
          <span className="h-4 w-4 rounded-[4px] bg-[#eef2f7]" />
          <span>Manj</span>
          <div className="flex items-center gap-1">
            {colors.slice(1).map((color) => (
              <span key={color} className="h-4 w-4 rounded-[4px]" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span>Več</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-0.5">
        <div className="min-w-max">
          <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3">
            <div aria-hidden="true" />
            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${weekCount}, ${heatmapCellSize}px)`,
                gap: `${heatmapGapSize}px`
              }}
            >
              {weeks.map((week, index) => (
                <div key={`${week.label}-${index}`} className="h-4 text-[12px] leading-none text-slate-500">
                  {week.label}
                </div>
              ))}
            </div>

            <div
              className="grid h-full gap-[3px] pt-[3px]"
              style={{
                gridTemplateRows: `repeat(7, ${heatmapCellSize}px)`,
                gap: `${heatmapGapSize}px`,
                paddingTop: `${heatmapGapSize}px`
              }}
              aria-hidden="true"
            >
              <span />
              <span className="flex items-center text-[12px] leading-none text-slate-500">T</span>
              <span />
              <span className="flex items-center text-[12px] leading-none text-slate-500">Č</span>
              <span />
              <span className="flex items-center text-[12px] leading-none text-slate-500">S</span>
              <span />
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${weekCount}, ${heatmapCellSize}px)`,
                gap: `${heatmapGapSize}px`,
                paddingTop: `${heatmapGapSize}px`
              }}
            >
              {weeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  className="grid"
                  style={{
                    gridTemplateRows: `repeat(7, ${heatmapCellSize}px)`,
                    gap: `${heatmapGapSize}px`
                  }}
                >
                  {week.days.map((day) => (
                    <span
                      key={day.dateKey}
                      className="block h-full w-full cursor-default rounded-[4px]"
                      style={{ backgroundColor: colors[day.level] }}
                      onPointerEnter={(event) => showHover(day, event.currentTarget)}
                      onPointerMove={(event) => showHover(day, event.currentTarget)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={(event) => showHover(day, event.currentTarget)}
                      onBlur={() => setHover(null)}
                      tabIndex={0}
                      aria-label={`${formatDate(day.date)}, Naročila: ${formatInt(day.orderCount)}, Prihodki: ${formatCurrency(day.revenue)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-20 w-[124px] -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
          style={{ left: hover.left, top: hover.top }}
        >
          <p className="text-[12px] font-semibold leading-4 text-slate-900">{formatDate(hover.day.date)}</p>
          <div className="mt-0.5 space-y-0.5 text-[12px] leading-[14px]">
            <p className="grid grid-cols-[50px_1fr] gap-0.5 text-slate-500">
              <span>Naročila:</span>
              <span className="whitespace-nowrap text-right font-semibold text-[#15803d]">{formatInt(hover.day.orderCount)}</span>
            </p>
            <p className="grid grid-cols-[50px_1fr] gap-0.5 text-slate-500">
              <span>Prihodki:</span>
              <span className="whitespace-nowrap text-right font-semibold text-[#15803d]">{formatCurrency(hover.day.revenue)}</span>
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
