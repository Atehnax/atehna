'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: 'landing', label: 'Glavna stran' },
  { value: 'navigation', label: 'Navigacija' },
  { value: 'logo', label: 'Logotip' },
  { value: 'global', label: 'Globalni parametri' },
  { value: 'products', label: 'Artikli' }
];

export default function AdminPodobaTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/podoba/globalni-parametri') || pathname.startsWith('/admin/podoba/globalni-slog')
    ? 'global'
    : pathname.startsWith('/admin/podoba/artikli')
      ? 'products'
    : pathname.startsWith('/admin/podoba/logotip') || pathname.startsWith('/admin/podoba/vizualno')
      ? 'logo'
    : pathname.startsWith('/admin/podoba/navigacija')
      ? 'navigation'
      : 'landing';

  return (
    <EuiTabs
      value={value}
      onChange={(next) => {
        if (next === 'global') router.push('/admin/podoba/globalni-parametri');
        else if (next === 'products') router.push('/admin/podoba/artikli');
        else if (next === 'logo') router.push('/admin/podoba/logotip');
        else if (next === 'navigation') router.push('/admin/podoba/navigacija');
        else router.push('/admin/podoba/glavna-stran');
      }}
      tabs={tabs}
    />
  );
}
