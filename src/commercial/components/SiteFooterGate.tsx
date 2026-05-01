'use client';

import { usePathname } from 'next/navigation';
import SiteFooter from '@/commercial/components/SiteFooter';

export default function SiteFooterGate() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return <SiteFooter />;
}
