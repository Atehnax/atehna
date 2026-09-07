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

export default function AdminPodobaTabs({onBeforeNavigate}: {onBeforeNavigate?:(href:string)=>boolean} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/podoba/globalni-parametri')
    ? 'global'
    : pathname.startsWith('/admin/podoba/artikli')
      ? 'products'
    : pathname.startsWith('/admin/podoba/logotip')
      ? 'logo'
    : pathname.startsWith('/admin/podoba/navigacija')
      ? 'navigation'
      : 'landing';

  return (
    <EuiTabs
      value={value}
      onChange={(next) => {
        if (next === value) return;
        const href = next === 'global' ? '/admin/podoba/globalni-parametri'
          : next === 'products' ? '/admin/podoba/artikli'
          : next === 'logo' ? '/admin/podoba/logotip'
          : next === 'navigation' ? '/admin/podoba/navigacija'
          : '/admin/podoba/glavna-stran';
        if (onBeforeNavigate && !onBeforeNavigate(href)) return;
        router.push(href);
      }}
      tabs={tabs}
    />
  );
}
