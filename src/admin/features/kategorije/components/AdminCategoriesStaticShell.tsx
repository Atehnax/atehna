'use client';

import Link from 'next/link';
import {
  AdminCategoriesMillerContentSkeleton,
  AdminCategoriesPreviewContentSkeleton,
  AdminCategoriesTableContentSkeleton
} from '@/admin/components/AdminPageSkeletons';
import type { CategoriesView } from '@/admin/features/kategorije/common/types';

const tabClassName = (active: boolean) =>
  `inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
  }`;

export default function AdminCategoriesStaticShell({ initialView }: { initialView: CategoriesView }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">
          Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu.
        </p>
      </header>

      <nav className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <Link href="/admin/kategorije" className={tabClassName(initialView === 'table')}>
          Osnovno
        </Link>
        <Link href="/admin/kategorije/predogled" className={tabClassName(initialView === 'preview')}>
          Predogled
        </Link>
        <Link href="/admin/kategorije/miller-view" className={tabClassName(initialView === 'miller')}>
          Po stolpcih
        </Link>
      </nav>

      {initialView === 'table' ? <AdminCategoriesTableContentSkeleton /> : null}
      {initialView === 'preview' ? <AdminCategoriesPreviewContentSkeleton /> : null}
      {initialView === 'miller' ? <AdminCategoriesMillerContentSkeleton /> : null}
    </div>
  );
}
