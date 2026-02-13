import type { Metadata } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import CartDrawer from '@/components/cart/CartDrawer';
import WebsiteAnalyticsTracker from '@/components/WebsiteAnalyticsTracker';
import { getCatalogSearchItems } from '@/lib/catalog';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const searchItems = getCatalogSearchItems();
  return (
    <html lang="sl">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <WebsiteAnalyticsTracker />
        <SiteHeader searchItems={searchItems} />
        <main className="min-h-[70vh]">{children}</main>
        <CartDrawer />
        <SiteFooter />
      </body>
    </html>
  );
}
