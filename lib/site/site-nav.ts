/**
 * Vacation Next main navigation, shared by the homepage header, the Results/site header and the
 * mobile drawer (t66u). Labels live in the chrome dictionary (`lib/i18n/chrome-copy.ts`).
 *
 * - No "Zoeken" entry: the homepage search module is the primary search entry.
 * - Legacy `/search` (old layout) is not a navigation destination.
 * - "Over ons" -> homepage value section (no separate about page exists).
 */
export type SiteNavKey = 'discover' | 'destinations' | 'inspiration' | 'offers' | 'about';

export type SiteNavItem = {
  key: SiteNavKey;
  href: string;
};

export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  { key: 'discover', href: '/ontdek' },
  { key: 'destinations', href: '/bestemmingen' },
  { key: 'inspiration', href: '/#inspiratie' },
  { key: 'offers', href: '/aanbiedingen' },
  { key: 'about', href: '/#value' },
] as const;
