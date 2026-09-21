/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 600,
  images: {
    // Cap below 3840: headless/retina * 100vw was requesting w=3840 and hanging the image optimizer (P12).
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
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