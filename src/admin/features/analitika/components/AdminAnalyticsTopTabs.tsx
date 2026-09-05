'use client';
import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';
export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname(), router = useRouter();
  const value = pathname.startsWith('/admin/analitika/diagnostika') ? 'diagnostics' : pathname.startsWith('/admin/analitika/splet') ? 'web' : 'orders';
  return <EuiTabs className="mb-4" value={value} onChange={next => {
    const path = next === 'web' ? '/admin/analitika/splet' : next === 'diagnostics' ? '/admin/analitika/diagnostika' : '/admin/analitika';
    const current = new URLSearchParams(window.location.search), params = new URLSearchParams();
    for (const key of ['range', 'from', 'to']) if (current.has(key)) params.set(key, current.get(key)!);
    router.push(path + (params.size ? '?' + params : ''));
  }} tabs={[{ value: 'orders', label: 'Poslovanje' }, { value: 'web', label: 'Splet' }, { value: 'diagnostics', label: 'Diagnostika' }]} />;
}
