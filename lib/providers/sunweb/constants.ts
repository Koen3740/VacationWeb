/** Observed Sunweb FE host from Sub 17-1 / Bijbel v0.1.4. */
export const SUNWEB_PROVIDER_NAME = 'Sunweb';
export const SUNWEB_FE_HOST = 'www.sunweb.be';
export const SUNWEB_ALLOWED_FE_HOSTS = [SUNWEB_FE_HOST] as const;
export type SunwebFeHost = (typeof SUNWEB_ALLOWED_FE_HOSTS)[number];

export const SUNWEB_PROMOTED_PRICE_PATH = '/api/sitecore/PromotedPrice/GetPromotedPriceApi';
export const SUNWEB_GROUPED_PRICES_PATH =
  '/api/sitecore/BookingGate/GetPricesGroupedByDurationApi';
export const SUNWEB_LIVE_TIMEOUT_MS = 15_000;

/**
 * Technical page-1 concurrency for PromotedPrice (landing + price).
 * Separate from Prijsvrij C=5 and Eliza PromotedPrice. Not a product rule.
 * Fixed at 5 — the failed L1 C=8 env canary is intentionally not shipped.
 */
export const SUNWEB_LIVE_PAGE1_CONCURRENCY = 5;

/**
 * Full-matchset Sunweb throttle. Same width as page-1 (must stay in lockstep with
 * PAGE1 — previously hardcoded separately at 5 in page1-receipt-pricing.ts).
 */
export const SUNWEB_LIVE_MATCHSET_CONCURRENCY = SUNWEB_LIVE_PAGE1_CONCURRENCY;

/**
 * Opt-in keep-alive transport canary for www.sunweb.be only.
 * Set env to exactly `1` to enable. Default unset/other → native fetch.
 * Implemented in `lib/http/sunweb-keepalive-agent.ts`.
 */
export const SUNWEB_KEEPALIVE_ENV = 'VACATIONWEB_SUNWEB_KEEPALIVE';
