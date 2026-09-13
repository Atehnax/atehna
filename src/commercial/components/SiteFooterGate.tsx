'use client';

import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import SiteFooter from '@/commercial/components/SiteFooter';
import type { HomepageFooterSettings } from '@/shared/domain/landing/landingPage';

export default function SiteFooterGate({ footer }: { footer: HomepageFooterSettings }) {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  if (pathname?.startsWith('/admin')) return null;
  // The route tree remains the homepage during Vercel's internal ISR URL rewrite.
  // Its own renderer already includes the canonical footer.
  if (segment === null) return null;

  return <SiteFooter settings={footer} />;
}
