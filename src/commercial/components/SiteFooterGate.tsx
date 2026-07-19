'use client';

import { usePathname } from 'next/navigation';
import SiteFooter from '@/commercial/components/SiteFooter';
import type { HomepageFooterSettings } from '@/shared/domain/landing/landingPage';

export default function SiteFooterGate({ footer }: { footer: HomepageFooterSettings }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  if (pathname === '/') return null;

  return <SiteFooter settings={footer} />;
}
