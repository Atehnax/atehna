'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith('/admin/analitika/splet') ? 'web' : 'orders';

  return (
    <Tabs
      value={value}
      onValueChange={(next) => router.push(next === 'web' ? '/admin/analitika/splet' : '/admin/analitika')}
    >
      <TabsList className="mb-4">
        <TabsTrigger value="orders">Naročila</TabsTrigger>
        <TabsTrigger value="web">Splet</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
