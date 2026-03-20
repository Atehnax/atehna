import type { ReactNode } from 'react';

type DiagnosticsChartPoint = {
  timestamp: string;
  label: string;
  value: number;
};

const SVG_WIDTH = 720;
const SVG_HEIGHT = 220;
const MARGIN = {
  top: 16,
  right: 16,
  bottom: 44,
  left: 58
};
const PLOT_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

function formatTick(value: number, kind: 'count' | 'bytes') {
  if (kind === 'bytes') {
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
    return `${Math.round(value)} B`;
  }

  return new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatTimeTick(timestamp: string, windowMinutes: number) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    second: windowMinutes <= 5 ? '2-digit' : undefined,
    day: windowMinutes >= 24 * 60 ? '2-digit' : undefined,
    month: windowMinutes >= 24 * 60 ? '2-digit' : undefined,
    timeZone: 'UTC'
  }).format(date);
}

function buildPolyline(points: DiagnosticsChartPoint[], maxValue: number) {
  if (points.length === 0) return '';
  const step = points.length === 1 ? 0 : PLOT_WIDTH / (points.length - 1);

  return points
    .map((point, index) => {
      const x = MARGIN.left + index * step;
      const y = MARGIN.top + PLOT_HEIGHT - (point.value / maxValue) * PLOT_HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');
}

function pickXAxisTicks(points: DiagnosticsChartPoint[], windowMinutes: number) {
  if (points.length === 0) return [] as DiagnosticsChartPoint[];

  const maxTicks = windowMinutes <= 5 ? 5 : windowMinutes <= 15 ? 4 : windowMinutes <= 60 ? 5 : windowMinutes <= 360 ? 6 : 6;
  const step = Math.max(1, Math.ceil((points.length - 1) / Math.max(1, maxTicks - 1)));
  const ticks = points.filter((_, index) => index % step === 0);
  const lastPoint = points.at(-1);

  if (lastPoint && ticks.at(-1)?.timestamp !== lastPoint.timestamp) {
    ticks.push(lastPoint);
  }

  return ticks;
}

function buildYAxisTicks(maxValue: number) {
  const tickCount = 4;
  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = (maxValue / tickCount) * index;
    const y = MARGIN.top + PLOT_HEIGHT - (value / maxValue) * PLOT_HEIGHT;
    return { value, y };
  });
}

function EmptyChart({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Za izbrano okno še ni dovolj točk za prikaz grafa.
      </div>
    </section>
  );
}

export default function AdminDiagnosticsChart({
  title,
  description,
  points,
  color,
  valueKind,
  valueLabel,
  windowMinutes,
  footer
}: {
  title: string;
  description: string;
  points: DiagnosticsChartPoint[];
  color: string;
  valueKind: 'count' | 'bytes';
  valueLabel: string;
  windowMinutes: number;
  footer?: ReactNode;
}) {
  if (points.length === 0) {
    return <EmptyChart title={title} description={description} />;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const yAxisTicks = buildYAxisTicks(maxValue);
  const xAxisTicks = pickXAxisTicks(points, windowMinutes);
  const polyline = buildPolyline(points, maxValue);
  const step = points.length === 1 ? 0 : PLOT_WIDTH / (points.length - 1);
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

      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="mt-4 w-full rounded-lg bg-slate-50 p-2" role="img" aria-label={title}>
        {yAxisTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={MARGIN.left} y1={tick.y} x2={SVG_WIDTH - MARGIN.right} y2={tick.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={MARGIN.left - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {formatTick(tick.value, valueKind)}
            </text>
          </g>
        ))}

        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + PLOT_HEIGHT} stroke="#94a3b8" strokeWidth="1" />
        <line x1={MARGIN.left} y1={MARGIN.top + PLOT_HEIGHT} x2={SVG_WIDTH - MARGIN.right} y2={MARGIN.top + PLOT_HEIGHT} stroke="#94a3b8" strokeWidth="1" />

        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={polyline} />

        {points.map((point, index) => {
          const x = MARGIN.left + index * step;
          const y = MARGIN.top + PLOT_HEIGHT - (point.value / maxValue) * PLOT_HEIGHT;
          return (
            <g key={point.timestamp}>
              <circle cx={x} cy={y} r="3.5" fill={color} />
              <title>{`${formatTimeTick(point.timestamp, windowMinutes)} UTC · ${valueLabel}: ${formatTick(point.value, valueKind)}`}</title>
            </g>
          );
        })}

        {xAxisTicks.map((tick) => {
          const index = points.findIndex((point) => point.timestamp === tick.timestamp);
          const x = MARGIN.left + Math.max(0, index) * step;
          return (
            <g key={tick.timestamp}>
              <line x1={x} y1={MARGIN.top + PLOT_HEIGHT} x2={x} y2={MARGIN.top + PLOT_HEIGHT + 6} stroke="#94a3b8" strokeWidth="1" />
              <text x={x} y={SVG_HEIGHT - 10} textAnchor="middle" fontSize="11" fill="#64748b">
                {formatTimeTick(tick.timestamp, windowMinutes)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-slate-500">
        <span>Os X: čas (UTC)</span>
        <span>Os Y: {valueLabel}</span>
      </div>
      {footer ? <div className="mt-2 text-xs text-slate-500">{footer}</div> : null}
    </section>
  );
}
