const sensitiveOrderPageHeaders = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return ['/order/confirmation', '/order/narocilnica'].map((source) => ({
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
