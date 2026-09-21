/**
 * Discover destination model (homepage foundation).
 * Minimal fields only — do not invent country/region when not in seed data.
 *
 * Homepage can show up to 5 Discover slots (DEC-009). Seed currently has 4
 * active destinations; a 5th entry awaits a real asset (no invented claim).
 *
 * Build 02: slot model + per-slot failsafe (previousDestinationId).
 */
export type DiscoverDestinationStatus = 'active' | 'draft';

export type DiscoverDestination = {
  destinationId: string;
  name: string;
  /** Teaser / caption under or with the card */
  teaser: string;
  imageSrc: string;
  href?: string;
  status?: DiscoverDestinationStatus;
  // Optional structured geography — only when known from existing card data.
  // country?: string;
  // region?: string;
};

/** Safe local mood fallback when a Discover image fails to load (no place-truth claim). */
export const DISCOVER_IMAGE_FALLBACK_SRC = '/images/wow-ssot/inspiration.jpg' as const;

/** Homepage Discover slot capacity (DEC-009). */
export const HOMEPAGE_DISCOVER_LIMIT = 5 as const;

/** Zero-based homepage Discover slot index (capacity 5). */
export type DiscoverSlotIndex = 0 | 1 | 2 | 3 | 4;

/**
 * One homepage Discover slot: intended destination + failsafe previous.
 * previousDestinationId enables per-slot failsafe when current is missing/inactive.
 */
export type DiscoverHomepageSlot = {
  slotIndex: DiscoverSlotIndex;
  /** Current intended destination for this slot */
  destinationId: string | null;
  /** Previous valid destination — failsafe when current missing/inactive */
  previousDestinationId?: string | null;
};

/** Homepage slot state — length up to HOMEPAGE_DISCOVER_LIMIT. */
export type DiscoverHomepageSlotState = {
  slots: DiscoverHomepageSlot[];
};
