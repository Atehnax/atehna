'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderRow } from '@/lib/server/orders';
import { getStatusLabel, isOrderStatus } from '@/lib/orderStatus';
import { getPaymentLabel } from '@/lib/paymentStatus';

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const CHART_INNER_HEIGHT = 220;

const toAmount = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    value
  );

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')} %`;

const dayKey = (iso: string) => iso.slice(0, 10);

const statusPalette = ['#0f766e', '#334155', '#0ea5e9', '#16a34a', '#f97316', '#a855f7'] as const;
const paymentPalette = ['#0f766e', '#64748b', '#8b5cf6'] as const;

type DayPoint = {
  day: string;
  revenue: number;
  orders: number;
  statuses: Record<string, number>;
};

type DotPoint = { x: number; y: number; value: number; day: string };

const buildLinePoints = (values: number[], days: string[]): DotPoint[] => {
  if (values.length === 0) return [];
  const maxValue = Math.max(...values, 1);
  const step = values.length === 1 ? CHART_WIDTH : CHART_WIDTH / (values.length - 1);
  return values.map((value, index) => ({
    x: index * step,
    y: CHART_INNER_HEIGHT - (value / maxValue) * CHART_INNER_HEIGHT,
    value,
    day: days[index] ?? ''
  }));
};

const polyline = (points: DotPoint[]) => points.map((point) => `${point.x},${point.y}`).join(' ');

const donutSegment = (cx: number, cy: number, radius: number, start: number, end: number) => {
  const startX = cx + radius * Math.cos(start);
  const startY = cy + radius * Math.sin(start);
  const endX = cx + radius * Math.cos(end);
  const endY = cy + radius * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
};

export default function AdminAnalyticsDashboard({
  orders,
  initialFrom,
  initialTo
}: {
  orders: OrderRow[];
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [hoveredRevenue, setHoveredRevenue] = useState<number | null>(null);
  const [hoveredOrders, setHoveredOrders] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<{ day: string; status: string; count: number } | null>(null);
  const [hoveredPayment, setHoveredPayment] = useState<{ label: string; count: number; share: number } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + toAmount(order.total), 0);
    const totalOrders = orders.length;
    const paidCount = orders.filter((order) => order.payment_status === 'paid').length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const paidShare = totalOrders > 0 ? (paidCount / totalOrders) * 100 : 0;

    return { totalRevenue, totalOrders, averageOrderValue, paidShare };
  }, [orders]);

  const byDay = useMemo(() => {
    const buckets = new Map<string, DayPoint>();
    orders.forEach((order) => {
      const key = dayKey(order.created_at);
      const safeStatus = isOrderStatus(order.status) ? order.status : 'unknown';
      const current = buckets.get(key) ?? { day: key, revenue: 0, orders: 0, statuses: {} };
      current.revenue += toAmount(order.total);
      current.orders += 1;
      current.statuses[safeStatus] = (current.statuses[safeStatus] ?? 0) + 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [orders]);

  const statusKeys = useMemo(() => {
    const set = new Set<string>();
    byDay.forEach((point) => Object.keys(point.statuses).forEach((status) => set.add(status)));
    return Array.from(set.values());
  }, [byDay]);

  const paymentDistribution = useMemo(() => {
    const total = Math.max(orders.length, 1);
    const groups = ['paid', 'unpaid', 'refunded'];

    return groups.map((group, index) => {
      const count = orders.filter((order) => (order.payment_status ?? 'unpaid') === group).length;
      return {
        key: group,
        label: getPaymentLabel(group),
        count,
        share: (count / total) * 100,
        color: paymentPalette[index] ?? '#64748b'
      };
    });
  }, [orders]);

  const revenuePoints = useMemo(
    () => buildLinePoints(byDay.map((item) => item.revenue), byDay.map((item) => item.day)),
    [byDay]
  );
  const orderPoints = useMemo(
    () => buildLinePoints(byDay.map((item) => item.orders), byDay.map((item) => item.day)),
    [byDay]
  );

  const applyRange = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    router.push(`/admin/analitika/narocila${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const toggleLegend = (key: string) => {
    setHiddenSeries((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analitika naročil</h1>
        <p className="mt-1 text-sm text-slate-600">Povzetki in trendi za izbrano obdobje.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Od</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Do</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={applyRange}
            className="h-9 rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Uporabi obdobje
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Skupni prihodki</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(metrics.totalRevenue)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Število naročil</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{metrics.totalOrders}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Povprečna vrednost naročila</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(metrics.averageOrderValue)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Delež plačanih naročil</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(metrics.paidShare)}</p>
        </article>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Prihodki po dneh</h2>
        <p className="text-xs text-slate-500">X os: Datum · Y os: Prihodki (€)</p>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
          <line x1="0" y1={CHART_INNER_HEIGHT} x2={CHART_WIDTH} y2={CHART_INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={CHART_INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <polyline fill="none" stroke="#0f766e" strokeWidth="2.4" points={polyline(revenuePoints)} />
          {hoveredRevenue !== null && revenuePoints[hoveredRevenue] ? (
            <line
              x1={revenuePoints[hoveredRevenue]?.x}
              x2={revenuePoints[hoveredRevenue]?.x}
              y1="0"
              y2={CHART_INNER_HEIGHT}
              stroke="#0f766e"
              strokeWidth="1"
              opacity="0.35"
            />
          ) : null}
          {revenuePoints.map((point, index) => (
            <circle
              key={`rev-${point.day}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#0f766e"
              onMouseEnter={() => setHoveredRevenue(index)}
              onMouseLeave={() => setHoveredRevenue(null)}
            />
          ))}
          {hoveredRevenue !== null && revenuePoints[hoveredRevenue] ? (
            <g>
              <rect x="12" y="10" width="280" height="42" rx="6" fill="#0f172a" opacity="0.9" />
              <text x="20" y="28" fill="#fff" fontSize="11">{`Datum: ${revenuePoints[hoveredRevenue]?.day}`}</text>
              <text x="20" y="42" fill="#fff" fontSize="11">{`Prihodki: ${formatCurrency(revenuePoints[hoveredRevenue]?.value ?? 0)}`}</text>
            </g>
          ) : null}
        </svg>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Naročila po dneh</h2>
        <p className="text-xs text-slate-500">X os: Datum · Y os: Število naročil</p>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
          <line x1="0" y1={CHART_INNER_HEIGHT} x2={CHART_WIDTH} y2={CHART_INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={CHART_INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          {orderPoints.map((point, index) => (
            <rect
              key={`order-${point.day}`}
              x={Math.max(0, point.x - 6)}
              y={point.y}
              width="12"
              height={CHART_INNER_HEIGHT - point.y}
              rx="2"
              fill="#334155"
              opacity="0.8"
              onMouseEnter={() => setHoveredOrders(index)}
              onMouseLeave={() => setHoveredOrders(null)}
            />
          ))}
          {hoveredOrders !== null && orderPoints[hoveredOrders] ? (
            <line
              x1={orderPoints[hoveredOrders]?.x}
              x2={orderPoints[hoveredOrders]?.x}
              y1="0"
              y2={CHART_INNER_HEIGHT}
              stroke="#334155"
              strokeWidth="1"
              opacity="0.35"
            />
          ) : null}
          {hoveredOrders !== null && orderPoints[hoveredOrders] ? (
            <g>
              <rect x="12" y="10" width="280" height="42" rx="6" fill="#0f172a" opacity="0.9" />
              <text x="20" y="28" fill="#fff" fontSize="11">{`Datum: ${orderPoints[hoveredOrders]?.day}`}</text>
              <text x="20" y="42" fill="#fff" fontSize="11">{`Naročila: ${Math.round(orderPoints[hoveredOrders]?.value ?? 0)}`}</text>
            </g>
          ) : null}
        </svg>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Naročila po statusih skozi čas</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {statusKeys.map((status, index) => {
              const hidden = Boolean(hiddenSeries[status]);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleLegend(status)}
                  className={`rounded-full border px-2 py-1 ${hidden ? 'border-slate-300 text-slate-400' : 'border-slate-400 text-slate-700'}`}
                >
                  {getStatusLabel(status)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-slate-500">X os: Datum · Y os: Število naročil</p>
        <div className="mt-3 space-y-2">
          {byDay.map((point) => {
            const total = statusKeys.reduce((sum, status) => sum + (hiddenSeries[status] ? 0 : point.statuses[status] ?? 0), 0);
            return (
              <div key={point.day} className="flex items-center gap-3 text-xs">
                <span className="w-28 text-slate-500">{point.day}</span>
                <div className="flex h-3 flex-1 overflow-hidden rounded bg-slate-100">
                  {statusKeys.map((status, index) => {
                    if (hiddenSeries[status]) return null;
                    const count = point.statuses[status] ?? 0;
                    const width = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={`${point.day}-${status}`}
                        style={{ width: `${width}%`, backgroundColor: statusPalette[index % statusPalette.length] }}
                        title={`${point.day} · ${getStatusLabel(status)}: ${count}`}
                        onMouseEnter={() => setHoveredStatus({ day: point.day, status, count })}
                        onMouseLeave={() => setHoveredStatus(null)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {hoveredStatus ? (
          <p className="mt-2 text-xs text-slate-500">
            {hoveredStatus.day} · {getStatusLabel(hoveredStatus.status)}: {hoveredStatus.count}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Plačilni statusi</h2>
        <p className="text-xs text-slate-500">Delež po plačilnih statusih (%)</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr] md:items-center">
          <svg viewBox="0 0 220 220" className="mx-auto h-56 w-56">
            {paymentDistribution.reduce<{ angle: number; nodes: JSX.Element[] }>(
              (acc, row, index) => {
                const segmentAngle = (row.share / 100) * Math.PI * 2;
                const start = acc.angle;
                const end = start + segmentAngle;
                acc.nodes.push(
                  <path
                    key={row.key}
                    d={donutSegment(110, 110, 90, start, end)}
                    fill={row.color}
                    opacity="0.85"
                    onMouseEnter={() => setHoveredPayment({ label: row.label, count: row.count, share: row.share })}
                    onMouseLeave={() => setHoveredPayment(null)}
                  />
                );
                acc.angle = end;
                return acc;
              },
              { angle: -Math.PI / 2, nodes: [] }
            ).nodes}
            <circle cx="110" cy="110" r="52" fill="#fff" />
            <text x="110" y="110" textAnchor="middle" dominantBaseline="middle" className="fill-slate-600 text-[12px]">Plačila</text>
          </svg>

          <div className="space-y-2">
            {paymentDistribution.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700">{item.label}</span>
                </div>
                <span className="text-slate-500">{item.count} · {formatPercent(item.share)}</span>
              </div>
            ))}
          </div>
        </div>
        {hoveredPayment ? (
          <p className="mt-3 text-xs text-slate-500">
            {hoveredPayment.label}: {hoveredPayment.count} ({formatPercent(hoveredPayment.share)})
          </p>
        ) : null}
      </section>
    </div>
  );
}
