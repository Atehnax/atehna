'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/analitika/diagnostika')
    ? 'diagnostics'
    : pathname.startsWith('/admin/analitika/splet')
      ? 'web'
      : 'orders';

  useEffect(() => {
    ['/admin/analitika', '/admin/analitika/splet', '/admin/analitika/diagnostika'].forEach((href) => {
      if (href !== pathname) {
        router.prefetch(href);
      }
    });
  }, [pathname, router]);

  return (
    <EuiTabs
      className="mb-4"
      value={value}
      onChange={(next) =>
        router.push(
          next === 'web' ? '/admin/analitika/splet' : next === 'diagnostics' ? '/admin/analitika/diagnostika' : '/admin/analitika'
        )
      }
      tabs={[
        { value: 'orders', label: 'Naročila' },
        { value: 'web', label: 'Splet' },
        { value: 'diagnostics', label: 'Diagnostika' }
      ]}
    />
  );
}
