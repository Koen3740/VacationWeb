export type DiscoverDestinationStatus = 'active' | 'draft';

/**
 * Static Discover destination record.
 * Homepage selection is a later-friendly slice; rotation/pools are out of scope.
 */
export type DiscoverDestination = {
  destinationId: string;
  name: string;
  country?: string;
  region?: string;
  teaser: string;
  imageSrc: string;
  status: DiscoverDestinationStatus;
  href?: string;
};
