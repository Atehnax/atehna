'use client';

import { useMemo } from 'react';

type VisitsByDay = { day: string; visits: number };
type TopPage = { path: string; views: number };
type TopProduct = { product_id: string; views: number };

export default function AdminWebsiteAnalyticsDashboard({
  visitsByDay,
  topPages,
  topProducts,
  returningVisitors7d
}: {
  visitsByDay: VisitsByDay[];
  topPages: TopPage[];
  topProducts: TopProduct[];
  returningVisitors7d: number;
}) {
  const maxVisits = useMemo(() => Math.max(...visitsByDay.map((v) => v.visits), 1), [visitsByDay]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analitika spletne strani</h1>
        <p className="mt-1 text-sm text-slate-600">Obiski, strani, artikli in osnovna retencija obiskovalcev.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">7-dnevni vračajoči obiskovalci</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{returningVisitors7d}</p>
        </article>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Obiski po dneh</h2>
        <p className="text-xs text-slate-500">X os: Dan, Y os: Število obiskov</p>
        <div className="mt-3 grid gap-2">
          {visitsByDay.map((item) => (
            <div key={item.day} className="group flex items-center gap-3" title={`${item.day}: ${item.visits}`}>
              <div className="w-24 text-xs text-slate-500">{item.day}</div>
              <div className="h-2 flex-1 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-teal-700/70 transition group-hover:bg-teal-700"
                  style={{ width: `${(item.visits / maxVisits) * 100}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs text-slate-600">{item.visits}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Najbolj obiskane strani</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {topPages.map((row) => (
              <li key={row.path} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
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
              <li key={row.product_id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
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
