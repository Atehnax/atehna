'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { SiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';

function AdminHeaderPlaceholder() {
  return (
    <header
      className="h-[65px] border-b border-[#e5e5e5] bg-white"
      aria-hidden="true"
    />
  );
}

const SiteHeader = dynamic(
  () => import('@/commercial/components/SiteHeader'),
  { loading: () => <AdminHeaderPlaceholder /> }
);

export default function AdminRouteHeader({
  navigation
}: {
  navigation: SiteNavigationConfig;
}) {
  const pathname = usePathname();

  if (pathname !== '/admin/podoba/navigacija') {
    return <AdminHeaderPlaceholder />;
  }

  return <SiteHeader navigation={navigation} />;
}
