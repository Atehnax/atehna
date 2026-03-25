'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { AdminCategoriesPayload, CategoriesView } from '@/admin/features/kategorije/common/types';

const RuntimeByView = {
  table: dynamic(() => import('./AdminCategoriesTablePageClient'), { ssr: false }),
  preview: dynamic(() => import('./AdminCategoriesPreviewPageClient'), { ssr: false }),
  miller: dynamic(() => import('./AdminCategoriesMillerPageClient'), { ssr: false })
} as const;

const ViewLabel: Record<CategoriesView, string> = {
  table: 'tabela',
  preview: 'predogled',
  miller: 'miller'
};

function ReadOnlySummary({ payload, view }: { payload: AdminCategoriesPayload; view: CategoriesView }) {
  const categoryCount = payload.categories.length;
  const itemCount = useMemo(
    () =>
      payload.categories.reduce(
        (sum, category) => sum + (category.items?.length ?? 0) + (category.subcategories?.reduce((subSum, sub) => subSum + (sub.items?.length ?? 0), 0) ?? 0),
        0
      ),
    [payload.categories]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">
        Začetno je naložen hiter pregled ({ViewLabel[view]}). Urejevalnik se naloži šele ob interakciji.
      </p>
      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Kategorije: <strong>{categoryCount}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Vidni artikli: <strong>{itemCount}</strong></div>
      </div>
    </div>
  );
}

export default function AdminCategoriesRuntimeGate({
  initialPayload,
  initialView
}: {
  initialPayload: AdminCategoriesPayload;
  initialView: CategoriesView;
}) {
  const [interactive, setInteractive] = useState(false);

  if (!interactive) {
    return (
      <div className="space-y-4">
        <ReadOnlySummary payload={initialPayload} view={initialView} />
        <button
          type="button"
          onClick={() => setInteractive(true)}
          className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Omogoči urejanje
        </button>
      </div>
    );
  }

  const Runtime = RuntimeByView[initialView];
  return <Runtime initialPayload={initialPayload} />;
}
