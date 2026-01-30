/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp']
  },
  async redirects() {
    return [
      {
        source: '/products/drawing-tools',
        destination: '/products/risarski-pribor',
        permanent: true
      },
      {
        source: '/products/izolacija',
        destination: '/products/izolacijski-materiali',
        permanent: true
      },
      {
        source: '/products/metal-plates',
        destination: '/products/kovinske-plošče',
        permanent: true
      },
      {
        source: '/products/plastika-prozorni',
        destination: '/products/pleksi-in-plastika',
        permanent: true
      },
      {
        source: '/products/rulers-measurement',
        destination: '/products/ravnila-in-merila',
        permanent: true
      },
      {
        source: '/products/safety',
        destination: '/products/varnostna-oprema',
        permanent: true
      },
      {
        source: '/products/workshop-machines',
        destination: '/products/stroji-naprave',
        permanent: true
      }
    ];
  }
};

export default nextConfig;
