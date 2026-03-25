'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const WebsiteAnalyticsTracker = dynamic(() => import('@/commercial/components/WebsiteAnalyticsTracker'), { ssr: false });
const CartDrawer = dynamic(() => import('@/commercial/features/cart/CartDrawer'), { ssr: false });

export default function CommercialEnhancements() {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');

  if (isAdminPath) return null;

  return (
    <>
      <WebsiteAnalyticsTracker />
      <CartDrawer />
    </>
  );
}
