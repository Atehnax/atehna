'use client';

import { useMemo } from 'react';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/admin/components/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/admin/components/charts/chartTheme';

type DiagnosticsChartPoint = {
  timestamp: string;
  label: string;
  value: number;
};

function formatTick(value: number, kind: 'count' | 'bytes') {
  if (kind === 'bytes') {
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
    return `${Math.round(value)} B`;
  }

  return new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function getTimeAxis(windowMinutes: number): Partial<Layout['xaxis']> {
  if (windowMinutes <= 15) {
    return {
      tickformat: '%H:%M:%S',
      dtick: 60 * 1000,
      nticks: Math.min(windowMinutes + 1, 8)
    };
  }

  if (windowMinutes <= 60) {
    return {
      tickformat: '%H:%M',
      dtick: 5 * 60 * 1000,
      nticks: 8
    };
  }

  if (windowMinutes <= 6 * 60) {
    return {
      tickformat: '%H:%M',
      dtick: 30 * 60 * 1000,
      nticks: 8
    };
  }

  return {
    tickformat: '%d.%m. %H:%M',
    dtick: 2 * 60 * 60 * 1000,
    nticks: 8
  };
}

export default function AdminDiagnosticsChart({
  title,
  description,
  points,
  color,
  valueKind,
  valueLabel,
  windowMinutes,
  height = 240
}: {
  title: string;
  description: string;
  points: DiagnosticsChartPoint[];
  color: string;
  valueKind: 'count' | 'bytes';
  valueLabel: string;
  windowMinutes: number;
  height?: number;
}) {
  const theme = useMemo(() => getChartThemeFromCssVars(), []);
  const baseLayout = useMemo(() => getBaseChartLayout(theme), [theme]);

  const trace = useMemo<Data[]>(() => [{
    type: 'scatter',
    mode: 'lines+markers',
    x: points.map((point) => point.timestamp),
    y: points.map((point) => point.value),
    text: points.map((point) => formatTick(point.value, valueKind)),
    line: { color, width: 2.5 },
    marker: { color, size: 5 },
    hovertemplate: '%{x|%d.%m.%Y %H:%M:%S} UTC<br>' + valueLabel + ': %{text}<extra></extra>'
  }], [color, points, valueKind, valueLabel]);

  const yMax = useMemo(() => {
    const max = Math.max(...points.map((point) => point.value), 0);
    if (max <= 0) return 1;
    return max * 1.1;
  }, [points]);

  const layout = useMemo<Partial<Layout>>(() => ({
    ...baseLayout,
    margin: { l: 64, r: 20, t: 20, b: 56 },
    showlegend: false,
    hovermode: 'x unified',
    xaxis: {
      ...getTimeAxis(windowMinutes),
      type: 'date',
      title: { text: 'Čas (UTC)', font: { size: 12, color: theme.mutedText } },
      showgrid: true,
      gridcolor: theme.grid,
      tickfont: { size: 11, color: theme.mutedText },
      showline: true,
      linecolor: theme.border,
      tickangle: 0,
      fixedrange: true,
      automargin: true
    },
    yaxis: {
      title: { text: valueLabel, font: { size: 12, color: theme.mutedText } },
      showgrid: true,
      gridcolor: theme.grid,
      zeroline: false,
      rangemode: 'tozero',
      range: [0, yMax],
      tickfont: { size: 11, color: theme.mutedText },
      tickformat: valueKind === 'count' ? ',d' : '~s',
      tickmode: 'auto',
      nticks: 6,
      ticklabeloverflow: 'allow',
      showline: true,
      linecolor: theme.border,
      fixedrange: true,
      automargin: true
    }
  }), [baseLayout, theme, windowMinutes, yMax, valueKind, valueLabel]);

  const lastPoint = points.at(-1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {lastPoint ? <p className="text-sm font-medium text-slate-700">Zadnja točka: {formatTick(lastPoint.value, valueKind)}</p> : null}
      </div>
      <PlotlyClient
        data={trace}
        layout={layout}
        config={{ responsive: true, displayModeBar: false }}
        useResizeHandler
        style={{ width: '100%', height }}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {points.slice(-4).map((point) => (
          <span key={point.timestamp}>{point.label}: {formatTick(point.value, valueKind)}</span>
        ))}
      </div>
    </section>
  );
}
