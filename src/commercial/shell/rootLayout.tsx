import type { Metadata } from 'next';
import SiteHeader from '@/commercial/components/SiteHeader';
import SiteFooterGate from '@/commercial/components/SiteFooterGate';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import CommercialEnhancements from '@/commercial/components/CommercialEnhancements';
import CommercialScaleFrame from '@/commercial/components/CommercialScaleFrame';
import { ProductAppearanceProvider } from '@/commercial/components/ProductAppearanceProvider';
import { ToastProvider, Toaster } from '@/shared/ui/toast';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';
import { getProductAppearanceConfig } from '@/shared/server/productAppearance';

export const metadata: Metadata = {
  metadataBase: new URL('https://atehna.si'),
  title: {
    default: 'Atehna | Oprema za tehnične učilnice',
    template: '%s | Atehna'
  },
  description:
    'Dobava materialov in opreme za tehnični pouk, delavnice in kabinetne prostore javnih šol po Sloveniji.',
  openGraph: {
    title: 'Atehna | Oprema za tehnične učilnice',
    description:
      'Dobava materialov in opreme za tehnični pouk, delavnice in kabinetne prostore javnih šol po Sloveniji.',
    url: 'https://atehna.si',
    siteName: 'Atehna',
    locale: 'sl_SI',
    type: 'website',
    images: [{ url: '/api/site-logo/social-share', width: 1200, height: 630, alt: 'Atehna' }]
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/site-logo/social-share']
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/api/site-logo/favicon', type: 'image/png', sizes: '48x48' }],
    apple: [{ url: '/api/site-logo/apple-touch-icon', type: 'image/png', sizes: '180x180' }]
  }
};

export default async function CommercialRootLayout({ children }: { children: React.ReactNode }) {
  const [siteNavigation, globalStyle, siteLogo, productAppearance] = await Promise.all([
    getSiteNavigationConfig(),
    getGlobalStyleConfig(),
    getSiteLogoConfig(),
    getProductAppearanceConfig()
  ]);

  return (
    <html lang="sl">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <ProductAppearanceProvider config={productAppearance}>
            <CommercialEnhancements
              siteStyle={globalStyle}
              productAppearance={productAppearance}
            />
            <SiteLogoProvider config={siteLogo}>
              <CommercialScaleFrame
                siteLayout={siteNavigation.siteLayout}
                siteStyle={globalStyle}
                productAppearance={productAppearance}
              >
                <SiteHeader navigation={siteNavigation} />
                <main className="site-page-surface flex-1">{children}</main>
                <SiteFooterGate footer={siteNavigation.footer} />
              </CommercialScaleFrame>
            </SiteLogoProvider>
          </ProductAppearanceProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
