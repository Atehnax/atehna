'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: 'landing', label: 'Glavna stran' },
  { value: 'navigation', label: 'Navigacija' },
  { value: 'visual', label: 'Vizualna podoba' }
];

export default function AdminPodobaTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/podoba/vizualno')
    ? 'visual'
    : pathname.startsWith('/admin/podoba/navigacija')
      ? 'navigation'
      : 'landing';

  return (
    <EuiTabs
      value={value}
      onChange={(next) => {
        if (next === 'visual') router.push('/admin/podoba/vizualno');
        else if (next === 'navigation') router.push('/admin/podoba/navigacija');
        else router.push('/admin/podoba/glavna-stran');
      }}
      tabs={tabs}
    />
  );
}
