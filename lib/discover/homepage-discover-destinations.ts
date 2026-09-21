import type { DiscoverDestination } from './types';
import { buildDiscoverDestinationHref } from './discover-destination-href';

/**
 * Static Discover pool seed (Build 01/02 + P4 click targets).
 * Exactly the 4 existing WOW Discover cards — no invented 5th destination.
 * Encoding: Albanië / Sicilië / Kreta / Sardinië (preserve carefully).
 *
 * imageSrc seed paths remain wow-ssot fallbacks; getDiscoverPool() overlays
 * Destination Media FINAL teasers when available (P3/P4).
 * href → /ontdekt/{destinationId} (never /#hero).
 */
export const HOMEPAGE_DISCOVER_DESTINATIONS: readonly DiscoverDestination[] = [
  {
    destinationId: 'albania',
    name: 'Albanië',
    teaser: 'De verborgen parel van Europa',
    imageSrc: '/images/wow-ssot/discover-albania.jpg',
    href: buildDiscoverDestinationHref('albania'),
    status: 'active',
  },
  {
    destinationId: 'sicily',
    name: 'Sicilië',
    teaser: 'Waar de zon nooit verveelt',
    imageSrc: '/images/wow-ssot/discover-sicily.jpg',
    href: buildDiscoverDestinationHref('sicily'),
    status: 'active',
  },
  {
    destinationId: 'crete',
    name: 'Kreta',
    teaser: 'Meer dan alleen stranden',
    imageSrc: '/images/wow-ssot/discover-crete.jpg',
    href: buildDiscoverDestinationHref('crete'),
    status: 'active',
  },
  {
    destinationId: 'sardinia',
    name: 'Sardinië',
    teaser: 'Wild, puur en onvergetelijk',
    imageSrc: '/images/wow-ssot/discover-sardinia.jpg',
    href: buildDiscoverDestinationHref('sardinia'),
    status: 'active',
  },
] as const;