import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { parseAccommodationTypesParam } from '@/lib/search/accommodation-type-filter';
import { parseAmenitiesParam } from '@/lib/search/amenity-filters';
import {
  parseBeachLocationsParam,
  parseCenterLocationsParam,
} from '@/lib/search/location-filters';
import {
  parsePage1IdsParam,
  parseResultsPageParam,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { parseStarsParam } from '@/lib/search/stars-param';
import { parseHasCarRentalParam } from '@/lib/offers/has-car-rental';
import { parseVacationTypesParam } from '@/lib/search/vacation-type';
import {
  parseTravelersFromQuery,
  travelersStateToParty,
} from '@/components/search/travelers-popup/travelers-popup-utils';
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
    adults: typeof searchParams.adults === 'string' ? Number(searchParams.adults) : undefined,
    children: typeof searchParams.children === 'string' ? Number(searchParams.children) : undefined,
    babies: typeof searchParams.babies === 'string' ? Number(searchParams.babies) : undefined,
    rooms: typeof searchParams.rooms === 'string' ? Number(searchParams.rooms) : undefined,
    party: (() => {
      const parsed = parseTravelersFromQuery({
        dob: typeof searchParams.dob === 'string' ? searchParams.dob : undefined,
        partyRooms: typeof searchParams.partyRooms === 'string' ? searchParams.partyRooms : undefined,
        adults: typeof searchParams.adults === 'string' ? searchParams.adults : undefined,
        children: typeof searchParams.children === 'string' ? searchParams.children : undefined,
        babies: typeof searchParams.babies === 'string' ? searchParams.babies : undefined,
        rooms: typeof searchParams.rooms === 'string' ? searchParams.rooms : undefined,
      });
      if (!parsed) {
        return undefined;
      }
      if (typeof searchParams.dob !== 'string') {
        return undefined;
      }
      return travelersStateToParty(parsed);
    })(),
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

      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
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
    sort: typeof searchParams.sort === 'string' ? searchParams.sort : 'value',
    page: parseResultsPageParam(
      typeof searchParams.page === 'string' ? searchParams.page : undefined,
    ),
    pageSize: RESULTS_PAGE_SIZE_DEFAULT,
    page1Ids: parsePage1IdsParam(
      typeof searchParams.page1Ids === 'string' ? searchParams.page1Ids : undefined,
    ),
    selectedRoom: parseSelectedRoomParam(
      typeof searchParams.room === 'string' ? searchParams.room : undefined,
    ),
  };
}
