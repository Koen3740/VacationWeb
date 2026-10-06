import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { parseAccommodationTypesParam } from '@/lib/search/accommodation-type-filter';
import { parseAmenitiesParam } from '@/lib/search/amenity-filters';
import {
  parseBeachLocationsParam,
  parseCenterLocationsParam,
} from '@/lib/search/location-filters';
import {
  parseBeachDistanceParam,
  parseCenterDistanceParam,
  parseLiggingToggleParam,
} from '@/lib/search/ligging-filters';
import {
  parsePage1IdsParam,
  parseResultsPageParam,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { parseStarsParam } from '@/lib/search/stars-param';
import { parseHasCarRentalParam } from '@/lib/offers/has-car-rental';
import { parseCatalogGenerationParam } from '@/lib/search/catalog-generation-freeze';
import { parseProviderParam } from '@/lib/search/provider-filter';
import { parseVacationTypesParam } from '@/lib/search/vacation-type';
import {
  deriveOccupancyCounts,
  hasCompleteChildAges,
  partyFromModel,
  readTravelerQuery,
  type TravelerModel,
} from '@/lib/search/traveler-contract';
import { sanitizeDepartureSearchWindow } from '@/lib/search/departure-date';
import type { SearchParams } from '@/types/travel';

export type ResultsSearchParamsInput = Record<string, string | string[] | undefined>;

function parseSelectedRoomParam(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Shared URL → SearchParams parser for Results and Offer Detail.
 * Occupancy and dates must survive card → detail → back.
 */
export function parseSearchParams(searchParams: ResultsSearchParamsInput): SearchParams {
  const str = (key: string): string | undefined =>
    typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined;
  // DEC-019: one reader for the traveller contract (childAges; legacy dob/counts).
  const travelerQuery = readTravelerQuery({
    adults: str('adults'),
    children: str('children'),
    babies: str('babies'),
    childAges: str('childAges'),
    dob: str('dob'),
    partyRooms: str('partyRooms'),
    rooms: str('rooms'),
  });
  const knownParty: TravelerModel | null =
    // Legacy count-only links (no childAges, no dob) keep their raw counts and get no party.
    travelerQuery &&
    travelerQuery.source !== 'legacy-counts' &&
    hasCompleteChildAges(travelerQuery.childAges)
      ? {
          adults: travelerQuery.adults,
          childAges: travelerQuery.childAges,
          roomCount: travelerQuery.roomCount,
          roomAssignments: travelerQuery.roomAssignments,
        }
      : null;
  const derivedCounts = knownParty
    ? deriveOccupancyCounts(knownParty.adults, knownParty.childAges)
    : null;
  const boardTypes = typeof searchParams.boardTypes === 'string' ? searchParams.boardTypes.split(',') : undefined;
  const countryRaw = typeof searchParams.country === 'string' ? searchParams.country : undefined;
  const countries = countryRaw
    ? countryRaw.split(',').map((country) => canonicalizeCountryName(country.trim())).filter(Boolean)
    : undefined;
  const nightsRaw = typeof searchParams.nights === 'string' ? searchParams.nights : undefined;
  const nights = nightsRaw
    ? nightsRaw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
    : undefined;

  return {
    country: countries?.length === 1 ? countries[0] : undefined,
    countries: countries?.length ? countries : undefined,
    region: typeof searchParams.region === 'string'
      ? canonicalizeRegionName(searchParams.region) || undefined
      : undefined,
    city: typeof searchParams.city === 'string' ? searchParams.city : undefined,
    budgetMin: typeof searchParams.budgetMin === 'string' ? Number(searchParams.budgetMin) : undefined,
    budgetMax: typeof searchParams.budgetMax === 'string' ? Number(searchParams.budgetMax) : undefined,
    nightsMin: typeof searchParams.nightsMin === 'string' ? Number(searchParams.nightsMin) : undefined,
    nightsMax: typeof searchParams.nightsMax === 'string' ? Number(searchParams.nightsMax) : undefined,
    nights: nights?.length ? nights : undefined,
    boardTypes,
    accommodationTypes: (() => {
      if (typeof searchParams.accommodationTypes !== 'string') {
        return undefined;
      }
      const parsed = parseAccommodationTypesParam(searchParams.accommodationTypes);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    // With a known party the counts are derived from the child ages (consistent with the URL);
    // a count-only legacy link keeps its raw counts.
    adults: derivedCounts
      ? derivedCounts.adults
      : typeof searchParams.adults === 'string'
        ? Number(searchParams.adults)
        : undefined,
    children: derivedCounts
      ? derivedCounts.children
      : typeof searchParams.children === 'string'
        ? Number(searchParams.children)
        : undefined,
    babies: derivedCounts
      ? derivedCounts.babies
      : typeof searchParams.babies === 'string'
        ? Number(searchParams.babies)
        : undefined,
    rooms: typeof searchParams.rooms === 'string' ? Number(searchParams.rooms) : undefined,
    childAges: knownParty && knownParty.childAges.length > 0 ? knownParty.childAges : undefined,
    party: knownParty ? partyFromModel(knownParty) : undefined,
    ...(() => {
      const rawStart =
        typeof searchParams.departureStart === 'string' ? searchParams.departureStart : undefined;
      const rawEnd =
        typeof searchParams.departureEnd === 'string' ? searchParams.departureEnd : undefined;
      if (!rawStart && !rawEnd) {
        return { departureStart: undefined, departureEnd: undefined };
      }
      const window = sanitizeDepartureSearchWindow(rawStart, rawEnd);
      return {
        departureStart: window.departureStart,
        departureEnd: window.departureEnd,
      };
    })(),
    flexibilityDays: (() => {
      if (typeof searchParams.flexibilityDays !== 'string') {
        return undefined;
      }

      const parsed = Number(searchParams.flexibilityDays);

      // 0 = exact date; 1..3 = ± days around one exact date (SearchForm offers ± 1, 2, 3).
      // Filtering applies the margin only to an exact date, never to a period.
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 3) {
        return undefined;
      }

      return parsed;
    })(),
    departureAirport: typeof searchParams.departureAirport === 'string' ? searchParams.departureAirport : undefined,
    stars: (() => {
      if (typeof searchParams.stars !== 'string') {
        return undefined;
      }
      const parsed = parseStarsParam(searchParams.stars);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    vacationTypes: (() => {
      if (typeof searchParams.vacationTypes !== 'string') {
        return undefined;
      }
      const parsed = parseVacationTypesParam(searchParams.vacationTypes);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    beachLocation: (() => {
      if (typeof searchParams.beachLocation !== 'string') {
        return undefined;
      }
      const parsed = parseBeachLocationsParam(searchParams.beachLocation);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    centerLocation: (() => {
      if (typeof searchParams.centerLocation !== 'string') {
        return undefined;
      }
      const parsed = parseCenterLocationsParam(searchParams.centerLocation);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    coast: parseLiggingToggleParam(typeof searchParams.coast === 'string' ? searchParams.coast : undefined),
    urban: parseLiggingToggleParam(typeof searchParams.urban === 'string' ? searchParams.urban : undefined),
    rural: parseLiggingToggleParam(typeof searchParams.rural === 'string' ? searchParams.rural : undefined),
    centerDistance: (() => {
      if (typeof searchParams.centerDistance !== 'string') {
        return undefined;
      }
      const parsed = parseCenterDistanceParam(searchParams.centerDistance);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    beachDistance: (() => {
      if (typeof searchParams.beachDistance !== 'string') {
        return undefined;
      }
      const parsed = parseBeachDistanceParam(searchParams.beachDistance);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    amenities: (() => {
      if (typeof searchParams.amenities !== 'string') {
        return undefined;
      }
      const parsed = parseAmenitiesParam(searchParams.amenities);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    hasCarRental: parseHasCarRentalParam(
      typeof searchParams.hasCarRental === 'string' ? searchParams.hasCarRental : undefined,
    ),
    provider: parseProviderParam(
      typeof searchParams.provider === 'string' ? searchParams.provider : undefined,
    ),
    sort: typeof searchParams.sort === 'string' ? searchParams.sort : 'value',
    page: parseResultsPageParam(
      typeof searchParams.page === 'string' ? searchParams.page : undefined,
    ),
    pageSize: RESULTS_PAGE_SIZE_DEFAULT,
    page1Ids: parsePage1IdsParam(
      typeof searchParams.page1Ids === 'string' ? searchParams.page1Ids : undefined,
    ),
    catalogGen: parseCatalogGenerationParam(
      typeof searchParams.catalogGen === 'string' ? searchParams.catalogGen : undefined,
    ),
    selectedRoom: parseSelectedRoomParam(
      typeof searchParams.room === 'string' ? searchParams.room : undefined,
    ),
  };
}
