import type { Metadata } from 'next';
import SiteHeader from '@/commercial/components/SiteHeader';
import SiteFooter from '@/commercial/components/SiteFooter';
import CartDrawer from '@/commercial/features/cart/CartDrawer';
import WebsiteAnalyticsTracker from '@/commercial/components/WebsiteAnalyticsTracker';
import { ToastProvider, Toaster } from '@/shared/ui/toast';
import { getCatalogSearchItems } from '@/commercial/catalog/catalog';

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
    type: 'website'
  },
  icons: {
    icon: '/favicon.svg'
  }
};

export default function CommercialRootLayout({ children }: { children: React.ReactNode }) {
  const searchItems = getCatalogSearchItems();
  return (
    <html lang="sl">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <WebsiteAnalyticsTracker />
          <SiteHeader searchItems={searchItems} />
          <main className="flex-1">{children}</main>
          <CartDrawer />
          <SiteFooter />
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
