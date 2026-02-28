'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const tabs = [
  { value: '/admin/arhiv', label: 'Arhiv naročil' },
  { value: '/admin/arhiv/artikli', label: 'Arhiv artiklov' }
];

export default function AdminArchiveTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/arhiv/artikli') ? '/admin/arhiv/artikli' : '/admin/arhiv';

  return (
    <Tabs value={value} onValueChange={(next) => router.push(next)}>
      <TabsList className="mb-4">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
