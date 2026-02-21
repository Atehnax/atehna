/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp']
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
