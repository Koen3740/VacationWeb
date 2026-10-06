// Privacy (t361u): /results and /offers/[id] URLs can carry the search party (adults/childAges).
// Response headers only for these two routes (not /_next/static, not other pages):
// - Cache-Control: no-store -> browsers/CDNs/proxies must not store these responses
// - X-Robots-Tag: noindex, nofollow -> same signal as the page metadata, also for non-HTML responses
// No robots.txt Disallow for these paths on purpose (a blocked crawler would never see the noindex).
const PRIVATE_SEARCH_ROUTE_HEADERS = [
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: '/results', headers: PRIVATE_SEARCH_ROUTE_HEADERS },
      { source: '/offers/:path+', headers: PRIVATE_SEARCH_ROUTE_HEADERS },
    ];
  },
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