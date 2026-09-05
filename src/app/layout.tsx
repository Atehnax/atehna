import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter/wght-italic.css';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource-variable/ibm-plex-sans/wght-italic.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/source-sans-3/wght-italic.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/bitter/wght.css';
import '@fontsource-variable/bitter/wght-italic.css';
import '@fontsource/barlow/300.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/400-italic.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/500-italic.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/600-italic.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow/700-italic.css';
import '@fontsource/barlow/800.css';
import '@fontsource/barlow/900.css';
import '@/shared/styles/globals.css';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
