'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { adminSectionTabsListClass, adminSectionTabsTriggerClass } from '@/admin/components/adminSectionTabStyles';

const tabs = [
  { value: '/admin/arhiv', label: 'Arhiv naročil' },
  { value: '/admin/arhiv/artikli', label: 'Arhiv artiklov' }
];

export default function AdminArchiveTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/arhiv/artikli') ? '/admin/arhiv/artikli' : '/admin/arhiv';

  useEffect(() => {
    tabs.forEach((tab) => {
      if (tab.value !== pathname) {
        router.prefetch(tab.value);
      }
    });
  }, [pathname, router]);

  return (
    <Tabs value={value} onValueChange={(next) => router.push(next)} variant="motion">
      <TabsList className={adminSectionTabsListClass}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className={adminSectionTabsTriggerClass}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
