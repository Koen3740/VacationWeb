/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 600,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.corendonresources.com',
      },
      {
        protocol: 'https',
        hostname: 'objectstore.true.nl',
      },
      {
        protocol: 'https',
        hostname: 'static.sunweb.be',
      },
      {
        protocol: 'https',
        hostname: 'sundio-media.azureedge.net',
      },
      {
        protocol: 'https',
        hostname: 'static.elizawashere.be',
      },
      {
        protocol: 'https',
        hostname: 'cdn.prijsvrij.be',
      },
    ],
  },
};

module.exports = nextConfig;