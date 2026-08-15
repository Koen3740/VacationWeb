/** Observed Corendon FE host from Sub 17-1 coverage audit (Bijbel v0.1.5). */
export const CORENDON_PROVIDER_NAME = 'Corendon';
export const CORENDON_FE_BASE_URL = 'https://api-fe.corendonresources.com';
/** Observed FE version from coverage audit 2026-08-13 — not a product SLA. */
export const CORENDON_FE_VERSION = '382.0.0.3';
/** Proven BE host from Sub 17-1 / Bijbel v0.1.5. */
export const CORENDON_FE_HOST = 'www.corendon.be';
/** Host already present on Corendon.nl feed productURLs (campaign 38108). */
export const CORENDON_FE_HOST_NL = 'www.corendon.nl';
export const CORENDON_ALLOWED_FE_HOSTS = [CORENDON_FE_HOST, CORENDON_FE_HOST_NL] as const;
export type CorendonFeHost = (typeof CORENDON_ALLOWED_FE_HOSTS)[number];
export const CORENDON_LIVE_TIMEOUT_MS = 15_000;
/**
 * Technical page-1 concurrency for lowestpricesacco.
 * Separate from Prijsvrij C=5. Not a product rule.
 */
export const CORENDON_LIVE_PAGE1_CONCURRENCY = 5;

/**
 * Proven 2-adult partyComposition from the Sub 17-1 coverage audit.
 * lowestpricesacco occupancy is not proven price-determining; do not invent new encodings.
 */
export const CORENDON_DEFAULT_2A_PARTY = [['1-1-19860', '1-1-19861']] as const;
