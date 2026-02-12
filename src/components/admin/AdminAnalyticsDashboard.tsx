'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderRow } from '@/lib/server/orders';

const toAmount = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    value
  );

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')} %`;

const dayKey = (iso: string) => iso.slice(0, 10);

type Point = { day: string; revenue: number; orders: number };

const buildPoints = (values: number[], width = 700, height = 220) => {
  if (values.length === 0) return [] as Array<{ x: number; y: number }>;
  const maxValue = Math.max(...values, 1);
  const stepX = values.length === 1 ? width : width / (values.length - 1);
  return values.map((value, index) => ({ x: index * stepX, y: height - (value / maxValue) * height }));
};

const pointsToPolyline = (points: Array<{ x: number; y: number }>) => points.map((p) => `${p.x},${p.y}`).join(' ');

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
  const [showRevenue, setShowRevenue] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + toAmount(order.total), 0);
    const totalOrders = orders.length;
    const paidCount = orders.filter((order) => order.payment_status === 'paid').length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const paidShare = totalOrders > 0 ? (paidCount / totalOrders) * 100 : 0;

    return { totalRevenue, totalOrders, averageOrderValue, paidShare };
  }, [orders]);

  const byDay = useMemo(() => {
    const buckets = new Map<string, Point>();
    orders.forEach((order) => {
      const key = dayKey(order.created_at);
      const current = buckets.get(key) ?? { day: key, revenue: 0, orders: 0 };
      current.revenue += toAmount(order.total);
      current.orders += 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [orders]);

  const paymentDistribution = useMemo(() => {
    const total = Math.max(orders.length, 1);
    const groups = [
      { key: 'paid', label: 'Plačano' },
      { key: 'pending', label: 'V čakanju' },
      { key: 'unpaid', label: 'Neplačano' }
    ] as const;

    return groups.map((group) => {
      const count = orders.filter((order) => (order.payment_status ?? 'unpaid') === group.key).length;
      return { ...group, count, share: (count / total) * 100 };
    });
  }, [orders]);

  const revenuePoints = useMemo(() => buildPoints(byDay.map((item) => item.revenue)), [byDay]);
  const orderPoints = useMemo(() => buildPoints(byDay.map((item) => item.orders)), [byDay]);

  const applyRange = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    router.push(`/admin/analitika/narocila${params.toString() ? `?${params.toString()}` : ''}`);
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Prihodki in naročila po dnevih</h2>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setShowRevenue((v) => !v)} className={`rounded border px-2 py-1 ${showRevenue ? 'border-teal-700 text-teal-700' : 'border-slate-300 text-slate-500'}`}>Prihodki</button>
            <button onClick={() => setShowOrders((v) => !v)} className={`rounded border px-2 py-1 ${showOrders ? 'border-slate-700 text-slate-700' : 'border-slate-300 text-slate-500'}`}>Naročila</button>
          </div>
        </div>
        <p className="text-xs text-slate-500">X os: Dan · Y os: Vrednost / št. naročil</p>
        <svg viewBox="0 0 700 240" className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
          <line x1="0" y1="220" x2="700" y2="220" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="220" stroke="#cbd5e1" strokeWidth="1" />
          {showRevenue && <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={pointsToPolyline(revenuePoints)} />}
          {showOrders && <polyline fill="none" stroke="#334155" strokeWidth="2.5" points={pointsToPolyline(orderPoints)} />}
          {byDay.map((point, index) => {
            const x = revenuePoints[index]?.x ?? orderPoints[index]?.x ?? 0;
            return (
              <circle
                key={point.day}
                cx={x}
                cy="220"
                r="6"
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
          {hoveredIndex !== null && byDay[hoveredIndex] && (
            <g>
              <rect x="8" y="8" width="250" height="46" rx="6" fill="#0f172a" opacity="0.9" />
              <text x="16" y="24" fill="#fff" fontSize="11">{`Dan: ${byDay[hoveredIndex].day}`}</text>
              <text x="16" y="40" fill="#fff" fontSize="11">{`Prihodki: ${Math.round(byDay[hoveredIndex].revenue)} € · Naročila: ${byDay[hoveredIndex].orders}`}</text>
            </g>
          )}
        </svg>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Plačilni statusi</h2>
        <p className="text-xs text-slate-500">Y os: Delež naročil (%)</p>
        <div className="mt-3 space-y-2">
          {paymentDistribution.map((item) => (
            <div key={item.key}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div className="h-2 rounded bg-teal-700/70" style={{ width: `${item.share}%` }} title={`${item.share.toFixed(1).replace('.', ',')} %`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
