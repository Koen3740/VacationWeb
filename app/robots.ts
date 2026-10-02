import type { MetadataRoute } from 'next';

/**
 * Minimal robots for privacy-sensitive admin/preview surfaces.
 * Not a full SEO project (Sub 25 scope).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/results-preview', '/destination-popup-preview'],
    },
  };
}
