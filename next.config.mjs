import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Worktrees can share node_modules through a Windows junction. Turbopack
// must include both real paths in its root to resolve those dependencies.
const projectRoot = dirname(fileURLToPath(import.meta.url));
let developmentRoot = projectRoot;
if (process.env.NODE_ENV === 'development') {
  const dependenciesRoot = realpathSync(new URL('./node_modules', import.meta.url));
  while (true) {
    const dependencyPath = relative(developmentRoot, dependenciesRoot);
    const outsideRoot = isAbsolute(dependencyPath) || dependencyPath === '..' || dependencyPath.startsWith('..' + sep);
    if (!outsideRoot) break;
    const parent = dirname(developmentRoot);
    if (parent === developmentRoot) {
      throw new Error('The development checkout and node_modules must be on the same drive.');
    }
    developmentRoot = parent;
  }
}

const sensitiveOrderPageHeaders = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the development badge away from the admin sidebar logout control.
  devIndicators: { position: 'bottom-right' },
  ...(process.env.NODE_ENV === 'development' ? { turbopack: { root: developmentRoot } } : {}),
  // Catalog originals are CDN assets. Hosted validation reads them from the
  // trusted site origin instead of duplicating the library in every function.
  outputFileTracingExcludes: {
    '/*': ['./public/images/catalog/**/*']
  },
  async headers() {
    return [
      '/order/confirmation',
      '/order/narocilnica',
      '/quote-request/confirmation',
      '/quote/offer',
      '/offer/review'
    ].map((source) => ({
      source,
      headers: sensitiveOrderPageHeaders
    }));
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com'
      }
    ]
  }
};

export default nextConfig;
