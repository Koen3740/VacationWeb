/** Prijsvrij facade Search API (TD-014). */
export const PRIJSVRIJ_TOKEN_URL = 'https://www.prijsvrij.be/token/service';
export const PRIJSVRIJ_SEARCH_BASE_URL = 'https://facade.api.prijsvrij.be/api/v1/search';
export const PRIJSVRIJ_PORTAL = 'prijsvrij.be';
export const PRIJSVRIJ_PROVIDER_NAME = 'Prijsvrij';

/** Proven request filter Types from TD-014 capture. */
export const PRIJSVRIJ_FILTER_TYPE = {
  land: 2,
  regio: 4,
  reisduur: 6,
  transport: 7,
  vertrekdatum: 13,
  reisduurdagen: 20,
} as const;

export const PRIJSVRIJ_DEFAULT_PAGE_SIZE = 100;
/** Hard cap on Search pages; effective limit is min(this, ceil(TotalFound/pageSize)). */
export const PRIJSVRIJ_MAX_SEARCH_PAGES = 50;
export const PRIJSVRIJ_REQUEST_TIMEOUT_MS = 8_000;
export const PRIJSVRIJ_TOKEN_REFRESH_SKEW_MS = 60_000;
