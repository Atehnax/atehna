'use client';

import PlotlyClient from '@/admin/features/analitika/components/charts/PlotlyClient';
import { buildChartModel, chartTypeOptions, metricOptions, newSeries, transformOptions, updateSeries } from '@/admin/features/analitika/components/analytics/adminAnalyticsShared';
import type { ChartTheme } from '@/admin/features/analitika/components/charts/chartTheme';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartConfig, AnalyticsChartRow, AnalyticsChartSeries, AnalyticsChartType, AnalyticsGlobalAppearance, AnalyticsMetricField } from '@/shared/server/analyticsCharts';

export default function AnalyticsBuilderModal({ title, description, comment, chartType, config, data, onChangeTitle, onChangeDescription, onChangeComment, onChangeChartType, onChangeConfig, onClose, onSave, chartTheme, appearance, mode, onDelete }: { title: string; description: string; comment: string; chartType: AnalyticsChartType; config: AnalyticsChartConfig; data: OrdersAnalyticsResponse; onChangeTitle: (value: string) => void; onChangeDescription: (value: string) => void; onChangeComment: (value: string) => void; onChangeChartType: (value: AnalyticsChartType) => void; onChangeConfig: (value: AnalyticsChartConfig) => void; onClose: () => void; onSave: () => void; chartTheme: ChartTheme; appearance: AnalyticsGlobalAppearance; mode: 'create' | 'edit'; onDelete?: () => void; }) {
  const previewChart: AnalyticsChartRow = { id: -1, dashboard_key: 'narocila', key: 'preview', title, description, comment, chart_type: chartType, config_json: config, position: 0, is_system: false, created_at: '', updated_at: '' };
  const preview = buildChartModel(previewChart, data, chartTheme, appearance);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="max-h-[92vh] w-[1180px] overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{mode === 'edit' ? 'Edit chart' : 'New chart'}</h3>
          <div className="flex items-center gap-2">
            {onDelete ? <button className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-300" onClick={onDelete}>Delete</button> : null}
            <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Title" value={title} onChange={onChangeTitle} />
          <label className="text-xs text-slate-300">Chart type
            <select value={chartType} onChange={(event) => onChangeChartType(event.target.value as AnalyticsChartType)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1">{chartTypeOptions.map((typeOption) => <option key={typeOption} value={typeOption}>{typeOption}</option>)}</select>
          </label>
          <LabeledInput label="Description" value={description} onChange={onChangeDescription} />
          <LabeledInput label="Comment" value={comment} onChange={onChangeComment} />
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-700"><table className="min-w-full text-xs text-slate-300"><thead className="bg-slate-800 text-slate-500"><tr><th className="px-2 py-1 text-left">enabled</th><th className="px-2 py-1 text-left">metric</th><th className="px-2 py-1 text-left">aggregation</th><th className="px-2 py-1 text-left">transform</th><th className="px-2 py-1 text-left">chart type</th><th className="px-2 py-1 text-left">axis side</th><th className="px-2 py-1 text-left">axis label</th><th className="px-2 py-1 text-left">color</th><th className="px-2 py-1 text-left">action</th></tr></thead><tbody>
              {config.series.map((series, index) => (
                <tr key={series.id} className="border-t border-slate-800">
                  <td className="px-2 py-1"><input type="checkbox" checked={series.enabled} onChange={(event) => onChangeConfig(updateSeries(config, index, { enabled: event.target.checked }))} /></td>
                  <td className="px-2 py-1"><select value={series.field_key} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { field_key: event.target.value as AnalyticsMetricField }))}>{metricOptions.map((metricOption) => <option key={metricOption.value} value={metricOption.value}>{metricOption.value}</option>)}</select></td>
                  <td className="px-2 py-1"><select value={series.aggregation} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { aggregation: event.target.value as AnalyticsChartSeries['aggregation'] }))}><option value="sum">sum</option><option value="count">count</option><option value="avg">avg</option></select></td>
                  <td className="px-2 py-1"><select value={series.transform} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { transform: event.target.value as AnalyticsChartSeries['transform'] }))}>{transformOptions.map((transformOption) => <option key={transformOption} value={transformOption}>{transformOption}</option>)}</select></td>
                  <td className="px-2 py-1"><select value={series.chart_type} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { chart_type: event.target.value as AnalyticsChartType }))}>{chartTypeOptions.map((typeOption) => <option key={typeOption} value={typeOption}>{typeOption}</option>)}</select></td>
                  <td className="px-2 py-1"><select value={series.axis_side} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { axis_side: event.target.value as 'left' | 'right' }))}><option value="left">left</option><option value="right">right</option></select></td>
                  <td className="px-2 py-1"><input value={series.axis_label} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-0.5" onChange={(event) => onChangeConfig(updateSeries(config, index, { axis_label: event.target.value }))} aria-label="Axis label" /></td>
                  <td className="px-2 py-1"><input type="color" value={series.color} onChange={(event) => onChangeConfig(updateSeries(config, index, { color: event.target.value }))} /></td>
                  <td className="px-2 py-1"><button className="rounded border border-rose-500 px-2 py-0.5 text-[11px] text-rose-300" onClick={() => onChangeConfig({ ...config, series: config.series.filter((_, seriesIndex) => seriesIndex !== index) })}>x</button></td>
                </tr>
              ))}
            </tbody></table></div>

        <div className="mt-2"><button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" onClick={() => onChangeConfig({ ...config, series: [...config.series, newSeries('order_count', chartTheme.series.tertiary)] })}>+ Add series</button></div>
        <div className="mt-4 rounded border border-slate-700 bg-slate-950 p-3"><p className="mb-2 text-xs text-slate-500">Live preview</p><PlotlyClient data={preview.traces} layout={preview.layout} config={{ responsive: true, displayModeBar: false }} useResizeHandler style={{ width: '100%', height: 320 }} /></div>
        <div className="mt-4 flex justify-end gap-2"><button className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300" onClick={onClose}>Cancel</button><button className="rounded border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={onSave}>{mode === 'edit' ? 'Save changes' : 'Save chart'}</button></div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs text-slate-300">{label}<input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} /></label>;
}
