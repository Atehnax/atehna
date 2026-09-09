'use client';

import { numeric } from '../../lib/formatting';

import {
  adminAnalyticsPanelClassName,
  adminControlFocusTokenClasses,
  pillTokenClasses
} from '@/shared/ui/theme/tokens';
import { IconButton } from '@/shared/ui/icon-button';
import { DownloadIcon } from '@/shared/ui/icons/AdminActionIcons';
import { ChartColumn, Table2 } from 'lucide-react';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Data, Layout, PlotMouseEvent } from 'plotly.js';
import Plot from '../charts/PlotlyClient';

export const palette = ['#15803d', '#2563eb', '#b45309', '#7c3aed', '#0891b2'];
export type Drill = Record<string, string>;
export type TableRow = { values: Array<string | number | null>; drill?: Drill; href?: string };
export function downloadRows(name: string, columns: string[], rows: TableRow[]) {
  const cell = (value: string | number | null) => {
    const text = String(value ?? '');
    return '"' + (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(['\ufeff' + [columns, ...rows.map(row => row.values)].map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name + '.csv'; link.click(); URL.revokeObjectURL(url);
}

export function DataTable({ columns, rows, onDrill }: { columns: string[]; rows: TableRow[]; onDrill?: (drill: Drill) => void }) {
  return <div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-slate-500">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{row.values.map((value, column) => <td key={column} className="px-3 py-2 text-slate-700">{column === 0 && row.href ? <a href={row.href} className="text-blue-700 underline">{value}</a> : column === 0 && row.drill ? <button type="button" onClick={() => onDrill?.(row.drill!)} className="text-left text-blue-700 underline">{value}</button> : typeof value === 'number' ? numeric(value) : value ?? '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-4 text-xs text-slate-500">Ni opazovanj.</p>}</div>;
}
export default function BusinessChart({
  title, description, data, xTitle, yTitle, rows, columns, onDrill, children, layout,
  height, empty = false, toolbar, footer, compact = false
}: {
  title: string;
  description: string;
  data: Data[];
  xTitle?: string;
  yTitle?: string;
  rows?: TableRow[];
  columns?: string[];
  onDrill?: (drill: Drill) => void;
  children?: ReactNode;
  layout?: Partial<Layout>;
  height?: number;
  empty?: boolean;
  toolbar?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const [table, setTable] = useState(false);
  const chartHeight = height ?? (compact ? 210 : 220);
  const onPoint = (event: PlotMouseEvent) => {
    const point = event.points[0];
    const custom = point?.customdata;
    if (typeof custom !== 'string') return;
    try { onDrill?.(JSON.parse(custom) as Drill); } catch { /* A non-drillable summary mark. */ }
  };

  return (
    <article className={adminAnalyticsPanelClassName + (compact ? ' !p-3' : '')}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="text-sm font-semibold leading-5 text-slate-950">{title}</h2>
          <p className={compact ? 'mt-0.5 text-[11px] leading-4 text-slate-500' : 'mt-1 text-[11px] leading-relaxed text-slate-500'}>
            {description}
          </p>
        </div>
        {(toolbar || (rows && columns)) && (
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            {toolbar && <div className="min-w-0 max-w-full [&_select]:max-w-full">{toolbar}</div>}
            {rows && columns && (
              <div className="flex shrink-0 items-center gap-2">
                <div
                  className={pillTokenClasses.list + ' h-7 shrink-0 gap-0.5 !rounded-md p-0.5'}
                  role="group"
                  aria-label="Prikaz podatkov"
                >
                  {[false, true].map((tableView) => (
                    <button
                      key={tableView ? 'table' : 'chart'}
                      type="button"
                      aria-pressed={table === tableView}
                      aria-label={tableView ? 'Tabela' : 'Graf'}
                      title={tableView ? 'Prikaži tabelo' : 'Prikaži graf'}
                      onClick={() => setTable(tableView)}
                      className={[
                        pillTokenClasses.itemBase,
                        'inline-flex h-5 w-6 items-center justify-center !rounded border border-transparent',
                        table === tableView ? pillTokenClasses.itemActive : pillTokenClasses.itemIdle,
                        adminControlFocusTokenClasses
                      ].join(' ')}
                    >
                      {tableView ? <Table2 className="h-3.5 w-3.5" aria-hidden="true" /> : <ChartColumn className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <IconButton
                  type="button"
                  size="sm"
                  tone="neutral"
                  className={adminControlFocusTokenClasses + ' shrink-0'}
                  aria-label="Prenesi podatke CSV"
                  title="Prenesi CSV"
                  onClick={() => downloadRows(title, columns, rows)}
                >
                  <DownloadIcon className="!h-4 !w-4" />
                </IconButton>
              </div>
            )}
          </div>
        )}
      </div>
      {table && rows && columns ? (
        <div
          className={compact ? 'mt-2 min-w-0 [&>div]:h-full [&>div]:max-h-none' : 'mt-4'}
          style={compact ? { height: chartHeight } : undefined}
        >
          <DataTable columns={columns} rows={rows} onDrill={onDrill} />
        </div>
      ) : empty ? (
        <div className="flex items-center justify-center px-4 text-center text-sm text-slate-500" style={{ height: chartHeight }}>
          Ni uporabnih opazovanj. Manjkajoči podatki niso ničle.
        </div>
      ) : (
        <Plot
          data={data}
          layout={{
            autosize: true,
            height: chartHeight,
            paper_bgcolor: '#ffffff',
            plot_bgcolor: '#ffffff',
            font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#64748b' },
            margin: compact
              ? { l: yTitle ? 52 : 42, r: 12, t: data.length > 1 ? 24 : 12, b: xTitle ? 38 : 28 }
              : { l: 60, r: 18, t: 30, b: 52 },
            showlegend: data.length > 1,
            legend: { orientation: 'h', x: 0, y: compact ? 1.13 : 1.18, font: { size: 10 } },
            hovermode: 'closest',
            xaxis: { title: { text: xTitle, font: { size: 10 } }, gridcolor: '#f1f5f9', zeroline: false, automargin: true },
            yaxis: { title: { text: yTitle, font: { size: 10 } }, gridcolor: '#f1f5f9', zerolinecolor: '#e2e8f0', automargin: true },
            colorway: palette,
            ...layout
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ width: '100%' }}
          onClick={onPoint}
        />
      )}
      {children}
      {footer && (
        <div className={compact
          ? '-mx-3 -mb-3 mt-2 border-t border-slate-100 px-3 py-2'
          : '-mx-4 -mb-4 mt-3 border-t border-slate-100 px-4 py-3'}
        >
          {footer}
        </div>
      )}
    </article>
  );
}
const statLabels: Record<string, string> = { n: 'Opazovanja', count: 'Opazovanja', missing: 'Manjkajoči', excluded: 'Izključeni', minimum: 'Minimum', maximum: 'Maksimum', min: 'Minimum', max: 'Maksimum', mean: 'Povprečje', median: 'Mediana', q1: 'Q1', q3: 'Q3', iqr: 'Interkvartilni razmik', p90: '90. percentil', variance: 'Opisna varianca (n)', populationVariance: 'Opisna varianca (n)', sampleVariance: 'Vzorčna varianca (n − 1)', standardDeviation: 'Standardni odklon', sampleStandardDeviation: 'Vzorčni standardni odklon', coefficientOfVariation: 'Koeficient variacije' };
export function StatisticsDrawer({ statistics, unit, note }: { statistics: object; unit: string; note?: string }) {
  return <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><summary className="cursor-pointer font-medium text-slate-700">Statistika · {unit}</summary><p className="my-3 text-[11px] leading-relaxed text-slate-500">Kvantili: linearna interpolacija položaja (n − 1)p (tip 7). Opisna varianca deli z n; vzorčna z n − 1. Standardni odklon: {unit}; varianca: ({unit})². {note}</p><dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">{Object.entries(statistics).filter(([key, value]) => key in statLabels && (value === null || typeof value === 'number')).map(([key, value]) => <div key={key}><dt className="text-slate-500">{statLabels[key]}</dt><dd className="mt-0.5 font-semibold text-slate-900">{numeric(value)}</dd></div>)}</dl></details>;
}
