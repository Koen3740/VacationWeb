/** Prijsvrij facade Search API (TD-014). */
export const PRIJSVRIJ_TOKEN_URL = 'https://www.prijsvrij.be/token/service';
/** Receipt JWT bootstrap (IBE Bijbel v1.8) — not the Facade service token. */
export const PRIJSVRIJ_RECEIPT_TOKEN_URL = 'https://www.prijsvrij.be/token';
export const PRIJSVRIJ_RECEIPT_BASE_URL =
  'https://restapi.prijsvrij.be/api/accommodation';
export const PRIJSVRIJ_SEARCH_BASE_URL = 'https://facade.api.prijsvrij.be/api/v1/search';
export const PRIJSVRIJ_PORTAL = 'prijsvrij.be';
export const PRIJSVRIJ_PROVIDER_NAME = 'Prijsvrij';

/** Proven request filter Types from TD-014 / Receipt captures. */
export const PRIJSVRIJ_FILTER_TYPE = {
  land: 2,
  regio: 4,
  vertrekmaand: 5,
  reisduur: 6,
  transport: 7,
  luchthaven: 8,
  vertrekdatum: 13,
  reisduurdagen: 20,
} as const;

export const PRIJSVRIJ_DEFAULT_PAGE_SIZE = 100;
/** Hard cap on Search pages; effective limit is min(this, ceil(TotalFound/pageSize)). */
export const PRIJSVRIJ_MAX_SEARCH_PAGES = 50;
export const PRIJSVRIJ_REQUEST_TIMEOUT_MS = 8_000;
/** Receipt latency evidence ~7–20 s/call; client timeout for Package 1. */
export const PRIJSVRIJ_RECEIPT_TIMEOUT_MS = 25_000;
export const PRIJSVRIJ_TOKEN_REFRESH_SKEW_MS = 60_000;
/** Technical safety cap per page-1 pricing run — not a target. */
export const PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP = 10;
/** Soft max Prijsvrij slots on page 1 when other providers exist. */
export const PRIJSVRIJ_PAGE1_MAX_SLOTS = 3;
