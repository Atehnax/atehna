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

function buildPolyline(values: number[], width = 700, height = 220) {
  if (values.length === 0) return '';
  const maxValue = Math.max(...values, 1);
  const stepX = values.length === 1 ? width : width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

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

  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + toAmount(order.total), 0);
    const totalOrders = orders.length;
    const paidCount = orders.filter((order) => order.payment_status === 'paid').length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const paidShare = totalOrders > 0 ? (paidCount / totalOrders) * 100 : 0;

    return { totalRevenue, totalOrders, averageOrderValue, paidShare };
  }, [orders]);

  const byDay = useMemo(() => {
    const buckets = new Map<string, { revenue: number; orders: number }>();
    orders.forEach((order) => {
      const key = dayKey(order.created_at);
      const current = buckets.get(key) ?? { revenue: 0, orders: 0 };
      current.revenue += toAmount(order.total);
      current.orders += 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({ date, ...values }));
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

  const revenuePolyline = useMemo(() => buildPolyline(byDay.map((item) => item.revenue)), [byDay]);
  const orderPolyline = useMemo(() => buildPolyline(byDay.map((item) => item.orders)), [byDay]);

  const applyRange = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    router.push(`/admin/analitika${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Prihodki po dnevih</h2>
          <svg viewBox="0 0 700 220" className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
            <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={revenuePolyline} />
          </svg>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Naročila po dnevih</h2>
          <svg viewBox="0 0 700 220" className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
            <polyline fill="none" stroke="#334155" strokeWidth="2.5" points={orderPolyline} />
          </svg>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Plačilni statusi</h2>
        <div className="mt-3 space-y-2">
          {paymentDistribution.map((item) => (
            <div key={item.key}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div className="h-2 rounded bg-teal-700/70" style={{ width: `${item.share}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
