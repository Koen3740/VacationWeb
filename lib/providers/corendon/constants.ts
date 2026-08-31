/** Observed Corendon FE host from Sub 17-1 coverage audit (Bijbel v0.1.5). */
export const CORENDON_PROVIDER_NAME = 'Corendon';
export const CORENDON_FE_BASE_URL = 'https://api-fe.corendonresources.com';
/** Observed FE version from coverage audit 2026-08-13 — not a product SLA. */
export const CORENDON_FE_VERSION = '382.0.0.3';
/** Proven BE host from Sub 17-1 / Bijbel v0.1.5. */
export const CORENDON_FE_HOST = 'www.corendon.be';
/** Host already present on Corendon.nl feed productURLs (campaign 38108). */
export const CORENDON_FE_HOST_NL = 'www.corendon.nl';
/** Host already present on Corendon BE-FR feed productURLs (campaign 38103 / material 2312856). */
export const CORENDON_FE_HOST_BE_FR = 'fr.corendon.be';
export const CORENDON_ALLOWED_FE_HOSTS = [
  CORENDON_FE_HOST,
  CORENDON_FE_HOST_NL,
  CORENDON_FE_HOST_BE_FR,
] as const;
export type CorendonFeHost = (typeof CORENDON_ALLOWED_FE_HOSTS)[number];
export const CORENDON_LIVE_TIMEOUT_MS = 15_000;
/**
 * Technical page-1 concurrency for lowestpricesacco.
 * Separate from Prijsvrij C=5. Not a product rule.
 * Fase B4: raised Corendon-only (capacity audit supports c≈10–20); others stay at 5.
 */
export const CORENDON_LIVE_PAGE1_CONCURRENCY = 8;

/**
 * Full-matchset Corendon throttle. Same width as page-1; not a product cap.
 */
export const CORENDON_LIVE_MATCHSET_CONCURRENCY = 8;

/**
 * Proven 2-adult / 1-room partyComposition from the Sub 17-1 coverage audit.
 * Real ISO dates of birth are not a proven lowestpricesacco encoding.
 */
export const CORENDON_DEFAULT_2A_PARTY = [['1-1-19860', '1-1-19861']] as const;
/**
 * Technical adult occupancy classification for standard 2A pricing only
 * (2 adults / 1 room / 0 children / 0 babies, no user-entered ISO DOBs).
 *
 * Observed as Corendon's own Reisgezelschap default when a traveller is
 * added without an entered date of birth. Used only as upsales
 * `pax[].birthDate` input. Not a stored or displayed personal DOB.
 * Not applied to children or babies.
 */
export const CORENDON_ADULT_REFERENCE_DOB = '1986-01-01';
/**
 * Proven 2-adult / 2-room nested partyComposition (Bijbel §10.3).
 * Nested arrays are rooms; tokens are the same proven placeholders, not user DOBs.
 */
export const CORENDON_TWO_ROOM_2A_PARTY = [['1-1-19860'], ['1-1-19861']] as const;
