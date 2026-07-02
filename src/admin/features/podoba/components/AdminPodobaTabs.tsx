'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: 'navigation', label: 'Navigacija' },
  { value: 'visual', label: 'Vizualna podoba' }
];

export default function AdminPodobaTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/podoba/vizualno') ? 'visual' : 'navigation';

  return (
    <EuiTabs
      value={value}
      onChange={(next) => router.push(next === 'visual' ? '/admin/podoba/vizualno' : '/admin/podoba/navigacija')}
      tabs={tabs}
    />
  );
}
