'use client';

import type { ReactNode } from 'react';
import type { AnalyticsChartRow } from '@/shared/server/analyticsCharts';

export default function AnalyticsChartCardView({
  chart,
  isFocused,
  onFocus,
  onAction,
  children,
  cardBackground,
  reorderMode
}: {
  chart: AnalyticsChartRow;
  isFocused: boolean;
  onFocus: () => void;
  onAction: (action: 'edit' | 'delete' | 'export' | 'reorder') => void;
  children: ReactNode;
  cardBackground: string;
  reorderMode?: boolean;
}) {
  return (
    <section
      style={{ backgroundColor: cardBackground, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}
      className={`rounded-xl border p-3 shadow-lg transition ${isFocused ? 'border-slate-400' : 'border-slate-200'}`}
      onClick={onFocus}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{chart.title}</h2>
          {chart.description ? <p className="text-xs text-slate-500">{chart.description}</p> : null}
          {chart.comment ? <p className="mt-1 rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300">{chart.comment}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {reorderMode ? <span className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500">↕ Drag</span> : null}
          <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-600" onClick={() => onAction('edit')}>Edit</button>
          <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-600" onClick={() => onAction('export')}>CSV</button>
          <button className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-500" onClick={() => onAction('delete')}>Delete</button>
        </div>
      </div>
      {children}
    </section>
  );
}
