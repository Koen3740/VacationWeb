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
    ],
  },
};

module.exports = nextConfig;