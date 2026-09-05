import type { CSSProperties, ReactNode } from 'react';
import AdminRouteHeader from '@/admin/components/AdminRouteHeader';
import AdminLayout from '@/admin/pages/layout';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export default async function AdminRootLayout({
  children
}: {
  children: ReactNode;
}) {
  const [siteNavigation, siteLogo] = await Promise.all([
    getSiteNavigationConfig(),
    getSiteLogoConfig()
  ]);
  const { siteLayout } = siteNavigation;
  const style = {
    '--site-content-max-width': siteLayout.siteContentMaxWidthPx + 'px',
    '--site-gutter-min': siteLayout.siteGutterMinPx + 'px',
    '--site-gutter-max': siteLayout.siteGutterMaxPx + 'px',
    '--site-gutter':
      'clamp(' +
      siteLayout.siteGutterMinPx +
      'px, 4vw, ' +
      siteLayout.siteGutterMaxPx +
      'px)'
  } as CSSProperties;

  return (
    <SiteLogoProvider config={siteLogo}>
      <div
        style={style}
        className="flex min-h-screen flex-1 flex-col"
      >
        <AdminRouteHeader navigation={siteNavigation} />
        <main className="site-page-surface flex-1">
          <AdminLayout>{children}</AdminLayout>
        </main>
      </div>
    </SiteLogoProvider>
  );
}
