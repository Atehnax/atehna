'use client';

import { useMemo, useState } from 'react';

const toAmount = (value: number | string | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

type Point = { day: string; revenue: number; orders: number };

const buildPoints = (items: Point[], key: 'revenue' | 'orders', width = 360, height = 110) => {
  if (items.length === 0) return [] as Array<{ x: number; y: number; value: number; day: string }>;
  const max = Math.max(...items.map((item) => item[key]), 1);
  const step = items.length === 1 ? width : width / (items.length - 1);
  return items.map((item, index) => ({
    x: index * step,
    y: height - (item[key] / max) * height,
    value: item[key],
    day: item.day
  }));
};

const pointsToPolyline = (points: Array<{ x: number; y: number }>) => points.map((p) => `${p.x},${p.y}`).join(' ');

type OrdersMiniChartRow = { created_at: string; total: number | string | null; payment_status?: string | null };

export default function AdminOrdersMiniCharts({ orders }: { orders: OrdersMiniChartRow[] }) {
  const [hoveredRevenuePoint, setHoveredRevenuePoint] = useState<number | null>(null);
  const [hoveredOrderPoint, setHoveredOrderPoint] = useState<number | null>(null);

  const daily = useMemo(() => {
    const byDay = new Map<string, Point>();
    orders.forEach((order) => {
      const day = order.created_at.slice(0, 10);
      const row = byDay.get(day) ?? { day, revenue: 0, orders: 0 };
      row.revenue += toAmount(order.total);
      row.orders += 1;
      byDay.set(day, row);
    });

    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [orders]);

  const revenuePoints = useMemo(() => buildPoints(daily, 'revenue'), [daily]);
  const orderPoints = useMemo(() => buildPoints(daily, 'orders'), [daily]);

  return (
    <div className="mb-3 grid gap-2 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-slate-600">Prihodki po dneh</h3>
        <p className="text-[11px] text-slate-500">X os: Dan · Y os: Prihodki (€)</p>
        <svg viewBox="0 0 360 140" className="mt-2 w-full rounded bg-slate-50 p-1">
          <line x1="0" y1="110" x2="360" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <polyline fill="none" stroke="#0f766e" strokeWidth="2" points={pointsToPolyline(revenuePoints)} />
          {revenuePoints.map((point, index) => (
            <g key={`${point.day}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill="#0f766e"
                onMouseEnter={() => setHoveredRevenuePoint(index)}
                onMouseLeave={() => setHoveredRevenuePoint(null)}
              />
              {hoveredRevenuePoint === index && (
                <g>
                  <rect x={Math.min(point.x + 5, 255)} y={Math.max(point.y - 28, 0)} width="100" height="24" rx="4" fill="#0f172a" opacity="0.9" />
                  <text x={Math.min(point.x + 9, 259)} y={Math.max(point.y - 12, 14)} fill="#fff" fontSize="10">
                    {`${point.day}: ${Math.round(point.value)} €`}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-slate-600">Naročila po dneh</h3>
        <p className="text-[11px] text-slate-500">X os: Dan · Y os: Število naročil</p>
        <svg viewBox="0 0 360 140" className="mt-2 w-full rounded bg-slate-50 p-1">
          <line x1="0" y1="110" x2="360" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <polyline fill="none" stroke="#334155" strokeWidth="2" points={pointsToPolyline(orderPoints)} />
          {orderPoints.map((point, index) => (
            <g key={`${point.day}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill="#334155"
                onMouseEnter={() => setHoveredOrderPoint(index)}
                onMouseLeave={() => setHoveredOrderPoint(null)}
              />
              {hoveredOrderPoint === index && (
                <g>
                  <rect x={Math.min(point.x + 5, 255)} y={Math.max(point.y - 28, 0)} width="100" height="24" rx="4" fill="#0f172a" opacity="0.9" />
                  <text x={Math.min(point.x + 9, 259)} y={Math.max(point.y - 12, 14)} fill="#fff" fontSize="10">
                    {`${point.day}: ${point.value}`}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </section>
    </div>
  );
}
