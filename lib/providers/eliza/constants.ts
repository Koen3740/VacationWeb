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

/**
 * Opt-in keep-alive transport canary for www.elizawashere.be only.
 * Set env to exactly `1` to enable. Default unset/other → native fetch.
 * Implemented in `lib/http/eliza-keepalive-agent.ts`.
 */
export const ELIZA_KEEPALIVE_ENV = 'VACATIONWEB_ELIZA_KEEPALIVE';

/**
 * Optional override for Agent maxSockets (default 32).
 * Must be an integer 1–256; invalid/empty → default.
 * Does not change page-1 concurrency (C=5).
 */
export const ELIZA_KEEPALIVE_MAX_SOCKETS_ENV = 'VACATIONWEB_ELIZA_KEEPALIVE_MAX_SOCKETS';

/**
 * Default maxSockets for Eliza KA canary.
 * Peak in-flight under C=5 ≈ landing+GPP (≤10), plus brief stale-refresh overlap.
 * Diagnostic maxSockets=16 still saw AbortSignal timeouts; concurrent demand was
 * below 16, so those were likely hung connects (Node Agent ≠ Undici 10s connect
 * timeout), not proven Agent-queue starvation. 32 adds headroom against queueing
 * without raising C=5.
 */
export const ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT = 32;
