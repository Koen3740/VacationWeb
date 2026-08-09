import {
  PRIJSVRIJ_DEFAULT_PAGE_SIZE,
  PRIJSVRIJ_FILTER_TYPE,
  PRIJSVRIJ_PORTAL,
  PRIJSVRIJ_REQUEST_TIMEOUT_MS,
  PRIJSVRIJ_SEARCH_BASE_URL,
} from './constants';
import type { FetchLike } from './auth';

export type PrijsvrijSearchFilter = {
  Type: number;
  UrlName: string;
  Value: string;
};

export type PrijsvrijSearchListItem = {
  Id?: string | number;
  Name?: string;
  /** Prijsvrij Search resultaatprijs (niet booking/receipt). */
  Price?: number;
  Date?: string;
  Duration?: number;
  Transport?: string;
  BoardType?: string;
  Image?: string;
  Images?: unknown;
};

export type PrijsvrijSearchFilterItem = {
  Name?: string;
  Value?: string;
  Active?: boolean;
  Count?: number;
  Parent?: string;
};

export type PrijsvrijSearchFilterGroup = {
  UrlName?: string;
  FilterGroupType?: number;
  FilterType?: number;
  Items?: PrijsvrijSearchFilterItem[];
};

export type PrijsvrijSearchResponse = {
  List?: PrijsvrijSearchListItem[];
  Filters?: PrijsvrijSearchFilterGroup[];
  TotalFound?: number;
};

export type PrijsvrijSearchRequest = {
  filters: PrijsvrijSearchFilter[];
  currentUrl: string;
};

export async function searchPrijsvrij(
  token: string,
  request: PrijsvrijSearchRequest,
  options: {
    pageSize?: number;
    page?: number;
    fetchImpl?: FetchLike;
  } = {},
): Promise<PrijsvrijSearchResponse> {
  const pageSize = options.pageSize ?? PRIJSVRIJ_DEFAULT_PAGE_SIZE;
  const page = options.page ?? 1;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${PRIJSVRIJ_SEARCH_BASE_URL}/${pageSize}/${page}`;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Portal': PRIJSVRIJ_PORTAL,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(PRIJSVRIJ_REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Prijsvrij Search API returned HTTP ${response.status}`);
  }

  return (await response.json()) as PrijsvrijSearchResponse;
}

export function buildContextFilters(input: {
  departureDate: string;
  nights: number;
  transport: string;
}): PrijsvrijSearchFilter[] {
  return [
    {
      Type: PRIJSVRIJ_FILTER_TYPE.reisduurdagen,
      UrlName: 'reisduurdagen',
      Value: String(input.nights),
    },
    {
      Type: PRIJSVRIJ_FILTER_TYPE.vertrekdatum,
      UrlName: 'vertrekdatum',
      Value: input.departureDate,
    },
    {
      Type: PRIJSVRIJ_FILTER_TYPE.transport,
      UrlName: 'transport',
      Value: input.transport,
    },
  ];
}

export function buildDestinationFilters(input: {
  landValue: string;
  regioValue?: string;
}): PrijsvrijSearchFilter[] {
  const filters: PrijsvrijSearchFilter[] = [
    {
      Type: PRIJSVRIJ_FILTER_TYPE.land,
      UrlName: 'land',
      Value: input.landValue,
    },
  ];

  if (input.regioValue) {
    filters.push({
      Type: PRIJSVRIJ_FILTER_TYPE.regio,
      UrlName: 'regio',
      Value: input.regioValue,
    });
  }

  return filters;
}

export function normalizeFilterName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function findFilterValueByName(
  groups: PrijsvrijSearchFilterGroup[] | undefined,
  urlName: string,
  name: string,
): string | null {
  if (!groups?.length || !name.trim()) {
    return null;
  }

  const group = groups.find((item) => item.UrlName === urlName);
  if (!group?.Items?.length) {
    return null;
  }

  const wanted = normalizeFilterName(name);
  const exact = group.Items.find(
    (item) => typeof item.Name === 'string' && normalizeFilterName(item.Name) === wanted,
  );
  if (exact && typeof exact.Value === 'string' && exact.Value) {
    return exact.Value;
  }

  return null;
}

export function buildCurrentUrl(input: {
  departureDate: string;
  nights: number;
  transport: string;
  countrySlug?: string;
  regionSlug?: string;
}): string {
  const pathParts = ['https://www.prijsvrij.be/vakanties'];
  if (input.countrySlug) {
    pathParts.push(input.countrySlug);
  }
  if (input.regionSlug) {
    pathParts.push(input.regionSlug);
  }

  const url = new URL(pathParts.join('/'));
  url.searchParams.set('vertrekdatum', input.departureDate);
  url.searchParams.set('reisduurdagen', String(input.nights));
  url.searchParams.set('transport', input.transport.toLowerCase());
  return url.toString();
}
