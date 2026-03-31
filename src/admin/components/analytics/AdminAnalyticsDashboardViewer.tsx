'use client';

import { useEffect, useMemo, useState } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import dynamic from 'next/dynamic';
import AnalyticsChartCardView from '@/admin/components/analytics/AnalyticsChartCardView';
import AnalyticsPlotlySurface from '@/admin/components/analytics/AnalyticsPlotlySurface';
import { buildChartModel, newSeries, rangeOptions, type RangeOption } from '@/admin/components/analytics/adminAnalyticsShared';
import { getChartThemeFromCssVars } from '@/admin/components/charts/chartTheme';
import { useToast } from '@/shared/ui/toast';
import { SegmentedControl } from '@/shared/ui/segmented';
import { Spinner, TableSkeleton } from '@/shared/ui/loading';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartConfig, AnalyticsChartRow, AnalyticsChartType, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

const LazyAdminTools = dynamic(() => import('@/admin/components/analytics/AdminAnalyticsAdminTools'), { ssr: false });

type Props = {
  initialData: OrdersAnalyticsResponse;
  initialCharts: AnalyticsChartRow[];
  initialFocusKey?: string;
  initialAppearance: AnalyticsGlobalAppearance;
};

export default function AdminAnalyticsDashboardViewer({ initialData, initialCharts, initialFocusKey = '', initialAppearance }: Props) {
  const chartTheme = useMemo(() => getChartThemeFromCssVars(), []);
  const initialRange = initialData.range as RangeOption;
  const [range, setRange] = useState<RangeOption>(initialRange);
  const [data, setData] = useState(initialData);
  const [charts, setCharts] = useState(initialCharts);
  const [focusedKey, setFocusedKey] = useState(initialFocusKey);
  const [loading, setLoading] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState<number | null>(null);
  const [savedAppearance, setSavedAppearance] = useState(initialAppearance);
  const [previewAppearance, setPreviewAppearance] = useState(initialAppearance);
  const [builderConfig, setBuilderConfig] = useState<AnalyticsChartConfig>(() => ({ dataset: 'orders_daily', xField: 'date', xTitle: 'Datum', xTickFormat: '', xDateFormat: '%Y-%m-%d', xScale: 'linear', yLeftTitle: 'Vrednost', yLeftScale: 'linear', yLeftTickFormat: '', yRightEnabled: false, yRightTitle: 'Vrednost (desno)', yRightScale: 'linear', yRightTickFormat: '', grain: 'day', quickRange: '30d', filters: { customerType: 'all', status: 'all', paymentStatus: 'all', includeNulls: true }, series: [newSeries('order_count', chartTheme.series.primary)] }));
  const [builderTitle, setBuilderTitle] = useState('New chart');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderComment, setBuilderComment] = useState('');
  const [builderChartType, setBuilderChartType] = useState<AnalyticsChartType>('combo');
  const [confirmDeleteChartId, setConfirmDeleteChartId] = useState<number | null>(null);
  const [visibleChartCount, setVisibleChartCount] = useState(() => Math.min(4, initialCharts.length));
  const { toast } = useToast();

  useEffect(() => {
    setVisibleChartCount((current) => Math.min(Math.max(current, 4), charts.length));
  }, [charts.length]);

  useEffect(() => {
    if (reorderMode || charts.length <= visibleChartCount) return;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(
        () => setVisibleChartCount(charts.length),
        { timeout: 1200 }
      );
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => setVisibleChartCount(charts.length), 180);
    return () => globalThis.clearTimeout(timeoutId);
  }, [charts.length, reorderMode, visibleChartCount]);

  const chartsForInitialRender = useMemo(
    () => (reorderMode ? charts : charts.slice(0, visibleChartCount)),
    [charts, reorderMode, visibleChartCount]
  );

  const chartRenderModels = useMemo(
    () => chartsForInitialRender.map((chart) => buildChartModel(chart, data, chartTheme, previewAppearance)),
    [chartsForInitialRender, data, chartTheme, previewAppearance]
  );
  const modelById = useMemo(() => new Map(chartRenderModels.map((model) => [model.chart.id, model])), [chartRenderModels]);
  const shouldRenderAdminTools =
    showAppearance || reorderMode || builderOpen || confirmDeleteChartId !== null;

  const reloadCharts = async () => {
    const response = await fetch('/api/admin/analytics/charts');
    if (!response.ok) return;
    const payload = (await response.json()) as { charts: AnalyticsChartRow[]; appearance?: AnalyticsGlobalAppearance };
    setCharts(payload.charts);
    if (payload.appearance) {
      setSavedAppearance(payload.appearance);
      setPreviewAppearance(payload.appearance);
    }
  };

  const loadRange = async (nextRange: RangeOption) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/orders?range=${nextRange}&grouping=day`);
      if (!response.ok) return;
      const payload = (await response.json()) as OrdersAnalyticsResponse;
      setData(payload);
      setRange(nextRange);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('admin-analytics-range');
    if ((saved === '7d' || saved === '30d' || saved === '90d' || saved === '180d' || saved === '365d' || saved === 'ytd') && saved !== initialRange) void loadRange(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRange]);

  useEffect(() => {
    window.localStorage.setItem('admin-analytics-range', range);
  }, [range]);

  const persistOrder = async (updated: AnalyticsChartRow[], fallback?: AnalyticsChartRow[]) => {
    const response = await fetch('/api/admin/analytics/charts/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: updated.map((chart) => chart.id) }) });
    if (!response.ok && fallback) {
      setCharts(fallback);
      toast.error('Napaka pri shranjevanju');
      return;
    }
    await reloadCharts();
    toast.success('Shranjeno');
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = charts.findIndex((chart) => chart.id === Number(active.id));
    const newIndex = charts.findIndex((chart) => chart.id === Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = charts;
    const updated = arrayMove(charts, oldIndex, newIndex);
    setCharts(updated);
    await persistOrder(updated, previous);
  };

  const createOrUpdateChart = async () => {
    const url = editingChartId ? `/api/admin/analytics/charts/${editingChartId}` : '/api/admin/analytics/charts';
    const method = editingChartId ? 'PATCH' : 'POST';
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: builderTitle, description: builderDescription, comment: builderComment, chartType: builderChartType, config: builderConfig }) });
    if (response.ok) {
      setBuilderOpen(false); setEditingChartId(null); await reloadCharts(); toast.success(editingChartId ? 'Shranjeno' : 'Dodano'); return;
    }
    toast.error(editingChartId ? 'Napaka pri shranjevanju' : 'Napaka pri dodajanju');
  };

  const confirmDeleteChart = async () => {
    if (confirmDeleteChartId === null) return;
    const chartId = confirmDeleteChartId;
    setConfirmDeleteChartId(null);
    const previous = charts;
    setCharts((current) => current.filter((chart) => chart.id !== chartId));
    const response = await fetch(`/api/admin/analytics/charts/${chartId}`, { method: 'DELETE' });
    if (!response.ok) { setCharts(previous); toast.error('Napaka pri brisanju'); return; }
    await reloadCharts();
    toast.success('Izbrisano');
  };

  const openEdit = (chart: AnalyticsChartRow) => {
    setEditingChartId(chart.id);
    setBuilderTitle(chart.title);
    setBuilderDescription(chart.description ?? '');
    setBuilderComment(chart.comment ?? '');
    setBuilderChartType(chart.chart_type);
    setBuilderConfig(chart.config_json);
    setBuilderOpen(true);
  };

  return (
    <div className="min-h-full w-full rounded-2xl border border-slate-200 p-3 text-slate-900" style={{ backgroundColor: previewAppearance.sectionBg }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-[19px] font-semibold">Analytics (Orders)</h1><p className="text-[11px] text-slate-500">Timezone bucketing: UTC.</p></div>
        <div className="flex items-center gap-2">
          <SegmentedControl size="sm" value={range} onChange={(next) => void loadRange(next as RangeOption)} options={rangeOptions.map((option) => ({ value: option, label: option === 'ytd' ? 'YTD' : option }))} className="rounded-lg border-slate-300 bg-slate-100 p-0.5" />
          <button type="button" onClick={() => { setEditingChartId(null); setBuilderTitle('New chart'); setBuilderDescription(''); setBuilderComment(''); setBuilderChartType('combo'); setBuilderOpen(true); }} className="rounded-md border border-cyan-500 bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-cyan-500">New Chart</button>
          <button type="button" onClick={() => setShowAppearance((v) => !v)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">Appearance</button>
          <button type="button" onClick={() => setReorderMode((v) => !v)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">{reorderMode ? 'Done reorder' : 'Reorder'}</button>
        </div>
      </div>

      {loading ? <div className="mb-4 space-y-3"><p className="inline-flex items-center gap-2 text-[11px] text-slate-500"><Spinner size="sm" className="text-slate-500" />Loading analytics…</p><TableSkeleton rows={4} cols={2} className="border-slate-200" /></div> : null}

      {!reorderMode ? (
        <div className="grid gap-4 md:grid-cols-2">
          {chartRenderModels.map((model) => (
            <AnalyticsChartCardView
              key={model.chart.id}
              chart={model.chart}
              isFocused={focusedKey === model.chart.key}
              onFocus={() => setFocusedKey(model.chart.key)}
              cardBackground={model.resolvedCardBg}
              onAction={(action) => {
                if (action === 'edit') openEdit(model.chart);
                if (action === 'delete') setConfirmDeleteChartId(model.chart.id);
                if (action === 'export') exportCsv(model.chart.title, model.x, model.exportRows);
              }}
            >
              <AnalyticsPlotlySurface data={model.traces} layout={model.layout} onClick={() => setFocusedKey(model.chart.key)} />
            </AnalyticsChartCardView>
          ))}
        </div>
      ) : null}
      {!reorderMode && visibleChartCount < charts.length ? (
        <p className="mt-3 text-xs text-slate-500">Nalagam dodatne grafikone …</p>
      ) : null}

      {shouldRenderAdminTools ? (
        <LazyAdminTools
          showAppearance={showAppearance}
          reorderMode={reorderMode}
          builderOpen={builderOpen}
          confirmDeleteChartId={confirmDeleteChartId}
          setConfirmDeleteChartId={setConfirmDeleteChartId}
          onConfirmDelete={() => void confirmDeleteChart()}
          appearance={previewAppearance}
          savedAppearance={savedAppearance}
          onChangeAppearance={setPreviewAppearance}
          onResetAppearance={() => setPreviewAppearance(savedAppearance)}
          onSaveAppearance={async () => {
            const response = await fetch('/api/admin/analytics/charts/appearance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewAppearance) });
            if (!response.ok) return toast.error('Napaka pri shranjevanju');
            setSavedAppearance(previewAppearance);
            toast.success('Shranjeno');
          }}
          builder={{
            title: builderTitle,
            description: builderDescription,
            comment: builderComment,
            chartType: builderChartType,
            config: builderConfig,
            mode: editingChartId ? 'edit' : 'create',
            onChangeTitle: setBuilderTitle,
            onChangeDescription: setBuilderDescription,
            onChangeComment: setBuilderComment,
            onChangeChartType: setBuilderChartType,
            onChangeConfig: setBuilderConfig,
            onClose: () => { setBuilderOpen(false); setEditingChartId(null); },
            onSave: () => void createOrUpdateChart(),
            onDelete: editingChartId ? () => setConfirmDeleteChartId(editingChartId) : undefined
          }}
          data={data}
          chartTheme={chartTheme}
          sortable={reorderMode ? {
            ids: charts.map((chart) => chart.id),
            onDragEnd: (event) => void onDragEnd(event),
            renderItem: (id) => {
              const model = modelById.get(id);
              if (!model) return null;
              return (
                <AnalyticsChartCardView
                  chart={model.chart}
                  isFocused={focusedKey === model.chart.key}
                  onFocus={() => setFocusedKey(model.chart.key)}
                  cardBackground={model.resolvedCardBg}
                  reorderMode
                  onAction={(action) => {
                    if (action === 'edit') openEdit(model.chart);
                    if (action === 'delete') setConfirmDeleteChartId(model.chart.id);
                    if (action === 'export') exportCsv(model.chart.title, model.x, model.exportRows);
                  }}
                >
                  <AnalyticsPlotlySurface data={model.traces} layout={model.layout} onClick={() => setFocusedKey(model.chart.key)} />
                </AnalyticsChartCardView>
              );
            }
          } : undefined}
        />
      ) : null}
    </div>
  );
}

function exportCsv(chartTitle: string, x: string[], rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csvLines = [headers.join(',')];
  rows.forEach((row) => {
    csvLines.push(headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${chartTitle.toLowerCase().replace(/\s+/g, '-') || 'chart'}-${x.length}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
