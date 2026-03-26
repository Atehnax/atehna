'use client';

import dynamic from 'next/dynamic';

const WebsiteAnalyticsTracker = dynamic(() => import('@/commercial/components/WebsiteAnalyticsTracker'), { ssr: false });
const CartDrawer = dynamic(() => import('@/commercial/features/cart/CartDrawer'), { ssr: false });

export default function CommercialEnhancements() {
  return (
    <>
      <WebsiteAnalyticsTracker />
      <CartDrawer />
    </>
  );
}
