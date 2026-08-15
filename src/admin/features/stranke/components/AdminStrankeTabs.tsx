'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: '/admin/stranke/vse', label: 'Vse stranke' },
  { value: '/admin/stranke/sole', label: 'Seznam šol' }
];

export default function AdminStrankeTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/stranke/sole')
    ? '/admin/stranke/sole'
    : '/admin/stranke/vse';

  return (
    <EuiTabs value={value} onChange={(next) => router.push(next)} tabs={tabs} />
  );
}
