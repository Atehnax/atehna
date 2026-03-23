/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com'
      }
    ]
  },
  async redirects() {
    return [
      {
        source: '/admin/arhiv-izbrisanih',
        destination: '/admin/arhiv',
        permanent: true
      }
    ];
  }
};

export default nextConfig;
