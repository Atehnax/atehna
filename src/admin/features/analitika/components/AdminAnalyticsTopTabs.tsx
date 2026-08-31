'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/analitika/ponudbe')
    ? 'quotes'
    : pathname.startsWith('/admin/analitika/diagnostika')
    ? 'diagnostics'
    : pathname.startsWith('/admin/analitika/splet')
      ? 'web'
      : 'orders';

  return (
    <EuiTabs
      className="mb-4"
      value={value}
      onChange={(next) =>
        router.push(
          next === 'quotes'
            ? '/admin/analitika/ponudbe'
            : next === 'web'
              ? '/admin/analitika/splet'
              : next === 'diagnostics'
                ? '/admin/analitika/diagnostika'
                : '/admin/analitika'
        )
      }
      tabs={[
        { value: 'orders', label: 'Naročila' },
        { value: 'quotes', label: 'Povpraševanja in ponudbe' },
        { value: 'web', label: 'Splet' },
        { value: 'diagnostics', label: 'Diagnostika' }
      ]}
    />
  );
}
