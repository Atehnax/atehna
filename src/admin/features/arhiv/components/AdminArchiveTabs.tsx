'use client';

import { usePathname, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';

const tabs = [
  { value: '/admin/arhiv', label: 'Arhiv naročil' },
  { value: '/admin/arhiv/artikli', label: 'Izbrisani artikli' },
  { value: '/admin/arhiv/podoba', label: 'Arhiv podobe' }
];

export default function AdminArchiveTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/arhiv/podoba')
    ? '/admin/arhiv/podoba'
    : pathname.startsWith('/admin/arhiv/artikli')
      ? '/admin/arhiv/artikli'
      : '/admin/arhiv';

  return (
    <EuiTabs value={value} onChange={(next) => router.push(next)} tabs={tabs} />
  );
}
