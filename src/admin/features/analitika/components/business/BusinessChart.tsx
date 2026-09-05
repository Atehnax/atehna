'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Data, Layout, PlotMouseEvent } from 'plotly.js';
import Plot from '../charts/PlotlyClient';

export const eur = (value: number | null | undefined) => value == null ? 'Manjka podatek' : new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export const numeric = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? 'Ni na voljo' : new Intl.NumberFormat('sl-SI', { maximumFractionDigits: digits }).format(value);
export const percent = (value: number | null | undefined) => value == null ? 'Ni na voljo' : numeric(value * 100, 1) + ' %';
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
  return <div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-slate-500">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{row.values.map((value, column) => <td key={column} className="px-3 py-2 text-slate-700">{column === 0 && row.href ? <a href={row.href} className="text-blue-700 underline">{value}</a> : column === 0 && row.drill ? <button type="button" onClick={() => onDrill?.(row.drill!)} className="text-left text-blue-700 underline">{value}</button> : value ?? 'Manjka podatek'}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-4 text-xs text-slate-500">Ni opazovanj.</p>}</div>;
}
export default function BusinessChart({
  title, description, data, xTitle, yTitle, rows, columns, onDrill, children, layout, height = 220, empty = false
}: { title: string; description: string; data: Data[]; xTitle?: string; yTitle?: string; rows?: TableRow[]; columns?: string[]; onDrill?: (drill: Drill) => void; children?: ReactNode; layout?: Partial<Layout>; height?: number; empty?: boolean }) {
  const [table, setTable] = useState(false);
  const onPoint = (event: PlotMouseEvent) => {
    const point = event.points[0];
    const custom = point?.customdata;
    if (typeof custom !== 'string') return;
    try { onDrill?.(JSON.parse(custom) as Drill); } catch { /* A non-drillable summary mark. */ }
  };
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-950">{title}</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</p></div>{rows && columns && <div className="flex shrink-0 gap-2 text-[11px] text-blue-700"><button type="button" aria-pressed={table} onClick={() => setTable(!table)} className="rounded px-1 py-1 underline">{table ? 'Graf' : 'Tabela'}</button><button type="button" onClick={() => downloadRows(title, columns, rows)} className="rounded px-1 py-1 underline">CSV</button></div>}</div>
    {table && rows && columns ? <div className="mt-4"><DataTable columns={columns} rows={rows} onDrill={onDrill} /></div> : empty ? <div className="flex items-center justify-center px-4 text-center text-sm text-slate-500" style={{ height }}>Ni uporabnih opazovanj. Manjkajoči podatki niso ničle.</div> : <Plot data={data} layout={{ autosize: true, height, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#64748b' }, margin: { l: 60, r: 18, t: 30, b: 52 }, showlegend: data.length > 1, legend: { orientation: 'h', x: 0, y: 1.18, font: { size: 10 } }, hovermode: 'closest', xaxis: { title: { text: xTitle, font: { size: 10 } }, gridcolor: '#f1f5f9', zeroline: false, automargin: true }, yaxis: { title: { text: yTitle, font: { size: 10 } }, gridcolor: '#f1f5f9', zerolinecolor: '#e2e8f0', automargin: true }, colorway: palette, ...layout }} config={{ responsive: true, displayModeBar: false }} useResizeHandler style={{ width: '100%' }} onClick={onPoint} />}
    {children}
  </article>;
}
const statLabels: Record<string, string> = { n: 'Opazovanja', count: 'Opazovanja', missing: 'Manjkajoči', excluded: 'Izključeni', minimum: 'Minimum', maximum: 'Maksimum', min: 'Minimum', max: 'Maksimum', mean: 'Povprečje', median: 'Mediana', q1: 'Q1', q3: 'Q3', iqr: 'Interkvartilni razmik', p90: '90. percentil', variance: 'Opisna varianca (n)', populationVariance: 'Opisna varianca (n)', sampleVariance: 'Vzorčna varianca (n − 1)', standardDeviation: 'Standardni odklon', sampleStandardDeviation: 'Vzorčni standardni odklon', coefficientOfVariation: 'Koeficient variacije' };
export function StatisticsDrawer({ statistics, unit, note }: { statistics: object; unit: string; note?: string }) {
  return <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><summary className="cursor-pointer font-medium text-slate-700">Statistika · {unit}</summary><p className="my-3 text-[11px] leading-relaxed text-slate-500">Kvantili: linearna interpolacija položaja (n − 1)p (tip 7). Opisna varianca deli z n; vzorčna z n − 1. Standardni odklon: {unit}; varianca: ({unit})². {note}</p><dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">{Object.entries(statistics).filter(([key, value]) => key in statLabels && (value === null || typeof value === 'number')).map(([key, value]) => <div key={key}><dt className="text-slate-500">{statLabels[key]}</dt><dd className="mt-0.5 font-semibold text-slate-900">{value === null ? 'Ni na voljo' : numeric(value)}</dd></div>)}</dl></details>;
}
