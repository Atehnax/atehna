'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: '/admin/stranke/vse', label: 'Stranke' },
  { value: '/admin/stranke/sole-in-zavodi', label: 'Šole in zavodi' }
];

export default function AdminStrankeTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/stranke/sole-in-zavodi')
    ? '/admin/stranke/sole-in-zavodi'
    : '/admin/stranke/vse';

  return (
    <EuiTabs value={value} onChange={(next) => router.push(next)} tabs={tabs} />
  );
}
