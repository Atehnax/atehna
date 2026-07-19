import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atehna',
    short_name: 'Atehna',
    description: 'Oprema in materiali za tehnično izobraževanje.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0F172A',
    icons: [
      {
        src: '/api/site-logo/favicon',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/api/site-logo/pwa-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
