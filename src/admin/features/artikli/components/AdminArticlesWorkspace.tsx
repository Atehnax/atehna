'use client';
import { useCallback, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import EuiTabs from '@/shared/ui/eui-tabs';
import { ArticleNavigationGuardContext, type ArticleNavigationGuard } from './ArticleNavigationGuard';
const PricingStockWorkspace = dynamic(() => import('./pricing-stock/PricingStockWorkspace'), { loading: () => <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nalaganje cen in zaloge …</div> });
export default function AdminArticlesWorkspace({ view, children }: { view: 'list' | 'pricing-stock'; children?: ReactNode }) {
  const router = useRouter(), guard = useRef<ArticleNavigationGuard | null>(null), [pending, startTransition] = useTransition();
  const register = useCallback((next: ArticleNavigationGuard | null) => { guard.current = next; }, []);
  const navigate = (next: string) => {
    if (next === view || pending) return;
    const run = () => { const params = new URLSearchParams(window.location.search); if (next === 'pricing-stock') params.set('view', next); else params.delete('view'); startTransition(() => router.push('/admin/artikli' + (params.size ? '?' + params : ''), { scroll: false })); };
    if (guard.current) guard.current('menjavo zavihka', run); else run();
  };
  return <ArticleNavigationGuardContext.Provider value={register}>
    <div aria-busy={pending} className="min-w-0 space-y-3">
      <EuiTabs value={view} onChange={navigate} ariaLabel="Pogledi artiklov" idPrefix="articles" tabs={[{ value: 'list', label: 'Seznam artiklov', panelId: 'articles-list' }, { value: 'pricing-stock', label: 'Razlika v ceni', panelId: 'articles-pricing-stock' }]} />
      <section id={'articles-' + view} role="tabpanel" aria-labelledby={'articles-tab-' + view} className="min-w-0">
        {view === 'pricing-stock' ? <PricingStockWorkspace /> : children}
      </section>
    </div>
  </ArticleNavigationGuardContext.Provider>;
}
