import type { DiscoverDestination } from './types';

/**
 * Discover homepage SSOT (inspiration content only).
 * Country/region are included only when already present in catalog data.
 */
export const DISCOVER_DESTINATIONS: readonly DiscoverDestination[] = [
  {
    destinationId: 'albania',
    name: 'Albanië',
    country: 'Albanië',
    teaser: 'De verborgen parel van Europa',
    imageSrc: '/images/wow-ssot/discover-albania.jpg',
    status: 'active',
    href: '/#hero',
  },
  {
    destinationId: 'sicily',
    name: 'Sicilië',
    country: 'Italië',
    region: 'Sicilië',
    teaser: 'Waar de zon nooit verveelt',
    imageSrc: '/images/wow-ssot/discover-sicily.jpg',
    status: 'active',
  },
  {
    destinationId: 'crete',
    name: 'Kreta',
    country: 'Griekenland',
    region: 'Kreta',
    teaser: 'Meer dan alleen stranden',
    imageSrc: '/images/wow-ssot/discover-crete.jpg',
    status: 'active',
  },
  {
    destinationId: 'sardinia',
    name: 'Sardinië',
    country: 'Italië',
    region: 'Sardinië',
    teaser: 'Wild, puur en onvergetelijk',
    imageSrc: '/images/wow-ssot/discover-sardinia.jpg',
    status: 'active',
  },
];
