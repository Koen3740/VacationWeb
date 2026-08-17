/** Observed Eliza FE host from Sub 17-1 / Bijbel v0.1.2. */
export const ELIZA_PROVIDER_NAME = 'Eliza was here';
export const ELIZA_FE_HOST = 'www.elizawashere.be';
export const ELIZA_ALLOWED_FE_HOSTS = [ELIZA_FE_HOST] as const;
export type ElizaFeHost = (typeof ELIZA_ALLOWED_FE_HOSTS)[number];

export const ELIZA_PROMOTED_PRICE_PATH = '/api/sitecore/PromotedPrice/GetPromotedPriceApi';
export const ELIZA_LIVE_TIMEOUT_MS = 15_000;
/**
 * Technical page-1 concurrency for PromotedPrice (landing + price).
 * Separate from Prijsvrij C=5 and Corendon lowestpricesacco. Not a product rule.
 */
export const ELIZA_LIVE_PAGE1_CONCURRENCY = 5;
