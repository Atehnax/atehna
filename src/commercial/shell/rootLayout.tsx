import type { Metadata } from 'next';
import SiteHeader from '@/commercial/components/SiteHeader';
import SiteFooterGate from '@/commercial/components/SiteFooterGate';
import CommercialEnhancements from '@/commercial/components/CommercialEnhancements';
import CommercialScaleFrame from '@/commercial/components/CommercialScaleFrame';
import { ToastProvider, Toaster } from '@/shared/ui/toast';

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
  return (
    <html lang="sl">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <CommercialEnhancements />
          <CommercialScaleFrame>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooterGate />
          </CommercialScaleFrame>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
