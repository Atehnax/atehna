'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type VisitsByDay = { day: string; visits: number };
type RetentionByDay = { day: string; returning: number };
type TopPage = { path: string; views: number };
type TopProduct = { product_id: string; views: number };

const WIDTH = 760;
const HEIGHT = 240;
const INNER_HEIGHT = 200;

type DotPoint = { x: number; y: number; day: string; value: number };

const buildPoints = (rows: Array<{ day: string; value: number }>): DotPoint[] => {
  if (rows.length === 0) return [];
  const max = Math.max(...rows.map((row) => row.value), 1);
  const step = rows.length === 1 ? WIDTH : WIDTH / (rows.length - 1);
  return rows.map((row, index) => ({
    x: index * step,
    y: INNER_HEIGHT - (row.value / max) * INNER_HEIGHT,
    day: row.day,
    value: row.value
  }));
};

const toPolyline = (points: DotPoint[]) => points.map((point) => `${point.x},${point.y}`).join(' ');

export default function AdminWebsiteAnalyticsDashboard({
  visitsByDay,
  topPages,
  topProducts,
  returningVisitors7d,
  retentionByDay,
  initialFrom,
  initialTo
}: {
  visitsByDay: VisitsByDay[];
  topPages: TopPage[];
  topProducts: TopProduct[];
  returningVisitors7d: number;
  retentionByDay: RetentionByDay[];
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [hoveredVisit, setHoveredVisit] = useState<number | null>(null);
  const [hoveredRetention, setHoveredRetention] = useState<number | null>(null);

  const visitPoints = useMemo(
    () => buildPoints(visitsByDay.map((item) => ({ day: item.day, value: item.visits }))),
    [visitsByDay]
  );

  const retentionPoints = useMemo(
    () => buildPoints(retentionByDay.map((item) => ({ day: item.day, value: item.returning }))),
    [retentionByDay]
  );

  const applyRange = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    router.push(`/admin/analitika/splet${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analitika spletne strani</h1>
        <p className="mt-1 text-sm text-slate-600">Obiski, strani, artikli in osnovna retencija obiskovalcev.</p>
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
          <p className="text-xs uppercase text-slate-500">7-dnevni vračajoči obiskovalci</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{returningVisitors7d}</p>
        </article>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Obiski po dneh</h2>
        <p className="text-xs text-slate-500">X os: Datum · Y os: Število obiskov</p>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
          <line x1="0" y1={INNER_HEIGHT} x2={WIDTH} y2={INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <polyline fill="none" stroke="#0f766e" strokeWidth="2.4" points={toPolyline(visitPoints)} />
          {hoveredVisit !== null && visitPoints[hoveredVisit] ? (
            <line
              x1={visitPoints[hoveredVisit]?.x}
              x2={visitPoints[hoveredVisit]?.x}
              y1="0"
              y2={INNER_HEIGHT}
              stroke="#0f766e"
              strokeWidth="1"
              opacity="0.35"
            />
          ) : null}
          {visitPoints.map((point, index) => (
            <circle
              key={`visit-${point.day}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#0f766e"
              onMouseEnter={() => setHoveredVisit(index)}
              onMouseLeave={() => setHoveredVisit(null)}
            />
          ))}
          {hoveredVisit !== null && visitPoints[hoveredVisit] ? (
            <g>
              <rect x="12" y="10" width="240" height="42" rx="6" fill="#0f172a" opacity="0.9" />
              <text x="20" y="28" fill="#fff" fontSize="11">{`Datum: ${visitPoints[hoveredVisit]?.day}`}</text>
              <text x="20" y="42" fill="#fff" fontSize="11">{`Obiski: ${visitPoints[hoveredVisit]?.value}`}</text>
            </g>
          ) : null}
        </svg>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Vračajoči obiskovalci (dnevni trend)</h2>
        <p className="text-xs text-slate-500">X os: Datum · Y os: Število vračajočih</p>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 w-full overflow-visible rounded bg-slate-50 p-2">
          <line x1="0" y1={INNER_HEIGHT} x2={WIDTH} y2={INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={INNER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
          <polyline fill="none" stroke="#334155" strokeWidth="2.4" points={toPolyline(retentionPoints)} />
          {hoveredRetention !== null && retentionPoints[hoveredRetention] ? (
            <line
              x1={retentionPoints[hoveredRetention]?.x}
              x2={retentionPoints[hoveredRetention]?.x}
              y1="0"
              y2={INNER_HEIGHT}
              stroke="#334155"
              strokeWidth="1"
              opacity="0.35"
            />
          ) : null}
          {retentionPoints.map((point, index) => (
            <circle
              key={`ret-${point.day}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#334155"
              onMouseEnter={() => setHoveredRetention(index)}
              onMouseLeave={() => setHoveredRetention(null)}
            />
          ))}
          {hoveredRetention !== null && retentionPoints[hoveredRetention] ? (
            <g>
              <rect x="12" y="10" width="260" height="42" rx="6" fill="#0f172a" opacity="0.9" />
              <text x="20" y="28" fill="#fff" fontSize="11">{`Datum: ${retentionPoints[hoveredRetention]?.day}`}</text>
              <text x="20" y="42" fill="#fff" fontSize="11">{`Vračajoči: ${retentionPoints[hoveredRetention]?.value}`}</text>
            </g>
          ) : null}
        </svg>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Najbolj obiskane strani</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {topPages.map((row) => (
              <li key={row.path} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50" title={`${row.path}: ${row.views}`}>
                <span className="truncate">{row.path}</span>
                <span className="ml-2 text-xs text-slate-500">{row.views}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Najbolj gledani artikli</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {topProducts.map((row) => (
              <li key={row.product_id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50" title={`${row.product_id}: ${row.views}`}>
                <span className="truncate">{row.product_id}</span>
                <span className="ml-2 text-xs text-slate-500">{row.views}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
