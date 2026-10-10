/**
 * Active Results sidebar filters as removable chips.
 * Param names and serializers match FilterSidebar; this module only reads
 * and rewrites the URL. It does not filter offers.
 */
import { destinationDisplayLabel, decodeDestinationLabel } from '@/components/search/destination-popup/destination-search';
import {
  canonicalizeBoardTypes,
  type CanonicalBoardType,
} from '@/lib/offers/canonicalize-board-type';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { parseHasCarRentalParam, HAS_CAR_RENTAL_PARAM } from '@/lib/offers/has-car-rental';
import {
  parseAccommodationTypesParam,
  serializeAccommodationTypesParam,
  type AccommodationTypeFilter,
} from '@/lib/search/accommodation-type-filter';
import {
  AMENITY_LABELS,
  parseAmenitiesParam,
  serializeAmenitiesParam,
  type AmenityValue,
} from '@/lib/search/amenity-filters';
import {
  BEACH_DISTANCE_LABELS,
  BEACH_DISTANCE_PARAM,
  CENTER_DISTANCE_LABELS,
  CENTER_DISTANCE_PARAM,
  COAST_FILTER_LABEL,
  COAST_PARAM,
  RURAL_FILTER_LABEL,
  RURAL_PARAM,
  URBAN_FILTER_LABEL,
  URBAN_PARAM,
  parseBeachDistanceParam,
  parseCenterDistanceParam,
  parseLiggingToggleParam,
  serializeBeachDistanceParam,
  serializeCenterDistanceParam,
  type BeachDistance,
  type CenterDistance,
} from '@/lib/search/ligging-filters';
import {
  BEACH_LOCATION_LABELS,
  CENTER_LOCATION_LABELS,
  parseBeachLocationsParam,
  parseCenterLocationsParam,
  serializeBeachLocationsParam,
  serializeCenterLocationsParam,
  type BeachLocation,
  type CenterLocation,
} from '@/lib/search/location-filters';
import { parseProviderParam, PROVIDER_FILTER_PARAM } from '@/lib/search/provider-filter';
import { parseStarsParam, serializeStarsParam } from '@/lib/search/stars-param';
import {
  VACATION_TYPE_LABELS,
  parseVacationTypesParam,
  serializeVacationTypesParam,
  type VacationType,
} from '@/lib/search/vacation-type';

/** Same bounds as the Results price slider (filter-sidebar.tsx). */
const BUDGET_FILTER_MIN = 500;
const BUDGET_FILTER_MAX = 2000;

const CAR_RENTAL_FILTER_LABEL = 'Huurauto inbegrepen';

export type ResultFilterChip = {
  id: string;
  label: string;
  /** Budget is a new query generation; other chips keep the sidebar paging hint. */
  preservePage1Ids: boolean;
};

function chipId(kind: string, value = ''): string {
  return value ? `${kind}:${encodeURIComponent(value)}` : kind;
}

function splitChipId(id: string): { kind: string; value: string } {
  const index = id.indexOf(':');
  if (index < 0) {
    return { kind: id, value: '' };
  }
  return { kind: id.slice(0, index), value: decodeURIComponent(id.slice(index + 1)) };
}

function countriesInUrl(params: URLSearchParams): string[] {
  return (params.get('country') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function placeLabel(params: URLSearchParams, value: string, kind: 'region' | 'city'): string {
  for (const rawCountry of countriesInUrl(params)) {
    const country = canonicalizeCountryName(rawCountry);
    const label =
      kind === 'region'
        ? destinationDisplayLabel(country, { region: value })
        : destinationDisplayLabel(country, { city: value });
    if (label) {
      return label;
    }
  }
  return decodeDestinationLabel(value);
}

function euro(amount: number): string {
  return `€ ${amount.toLocaleString('nl-NL')}`;
}

function setSerialized(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function drop<T>(values: readonly T[], value: T): T[] {
  return values.filter((item) => item !== value);
}

export function listActiveResultFilterChips(params: URLSearchParams): ResultFilterChip[] {
  const chips: ResultFilterChip[] = [];

  for (const raw of countriesInUrl(params)) {
    const label = canonicalizeCountryName(raw) || raw;
    chips.push({ id: chipId('country', raw), label, preservePage1Ids: true });
  }

  const region = params.get('region')?.trim();
  if (region) {
    chips.push({
      id: chipId('region', region),
      label: placeLabel(params, region, 'region'),
      preservePage1Ids: true,
    });
  }

  const city = params.get('city')?.trim();
  if (city) {
    chips.push({
      id: chipId('city', city),
      label: placeLabel(params, city, 'city'),
      preservePage1Ids: true,
    });
  }

  const provider = parseProviderParam(params.get(PROVIDER_FILTER_PARAM));
  if (provider) {
    chips.push({ id: chipId('provider', provider), label: provider, preservePage1Ids: true });
  }

  const budgetMinRaw = params.get('budgetMin');
  const budgetMaxRaw = params.get('budgetMax');
  if (budgetMinRaw || budgetMaxRaw) {
    const minNumber = budgetMinRaw ? Number(budgetMinRaw) : BUDGET_FILTER_MIN;
    const maxNumber = budgetMaxRaw ? Number(budgetMaxRaw) : BUDGET_FILTER_MAX;
    const minLabel = !budgetMinRaw || minNumber <= BUDGET_FILTER_MIN ? '€ 0' : euro(minNumber);
    const maxLabel = !budgetMaxRaw || maxNumber >= BUDGET_FILTER_MAX ? '€ 2.000+' : euro(maxNumber);
    chips.push({
      id: 'budget',
      label: `${minLabel} – ${maxLabel}`,
      preservePage1Ids: false,
    });
  }

  for (const type of parseAccommodationTypesParam(params.get('accommodationTypes'))) {
    chips.push({ id: chipId('accommodation', type), label: type, preservePage1Ids: true });
  }

  for (const stars of parseStarsParam(params.get('stars'))) {
    chips.push({
      id: chipId('stars', String(stars)),
      label: `${stars} sterren`,
      preservePage1Ids: true,
    });
  }

  for (const board of canonicalizeBoardTypes(params.get('boardTypes')?.split(',').filter(Boolean) || [])) {
    chips.push({ id: chipId('board', board), label: board, preservePage1Ids: true });
  }

  for (const type of parseVacationTypesParam(params.get('vacationTypes'))) {
    chips.push({
      id: chipId('vacation', type),
      label: VACATION_TYPE_LABELS[type],
      preservePage1Ids: true,
    });
  }

  if (parseHasCarRentalParam(params.get(HAS_CAR_RENTAL_PARAM)) === true) {
    chips.push({ id: 'car', label: CAR_RENTAL_FILTER_LABEL, preservePage1Ids: true });
  }

  if (parseLiggingToggleParam(params.get(COAST_PARAM)) === true) {
    chips.push({ id: 'coast', label: COAST_FILTER_LABEL, preservePage1Ids: true });
  }
  if (parseLiggingToggleParam(params.get(URBAN_PARAM)) === true) {
    chips.push({ id: 'urban', label: URBAN_FILTER_LABEL, preservePage1Ids: true });
  }
  if (parseLiggingToggleParam(params.get(RURAL_PARAM)) === true) {
    chips.push({ id: 'rural', label: RURAL_FILTER_LABEL, preservePage1Ids: true });
  }

  for (const value of parseCenterDistanceParam(params.get(CENTER_DISTANCE_PARAM))) {
    chips.push({
      id: chipId('centerDistance', value),
      label: CENTER_DISTANCE_LABELS[value],
      preservePage1Ids: true,
    });
  }
  for (const value of parseBeachDistanceParam(params.get(BEACH_DISTANCE_PARAM))) {
    chips.push({
      id: chipId('beachDistance', value),
      label: BEACH_DISTANCE_LABELS[value],
      preservePage1Ids: true,
    });
  }

  for (const value of parseCenterLocationsParam(params.get('centerLocation'))) {
    chips.push({
      id: chipId('center', value),
      label: CENTER_LOCATION_LABELS[value],
      preservePage1Ids: true,
    });
  }
  for (const value of parseBeachLocationsParam(params.get('beachLocation'))) {
    chips.push({
      id: chipId('beach', value),
      label: BEACH_LOCATION_LABELS[value],
      preservePage1Ids: true,
    });
  }

  for (const amenity of parseAmenitiesParam(params.get('amenities'))) {
    chips.push({
      id: chipId('amenity', amenity),
      label: AMENITY_LABELS[amenity],
      preservePage1Ids: true,
    });
  }

  return chips;
}

const SIDEBAR_FILTER_KEYS = [
  'country',
  'region',
  'city',
  PROVIDER_FILTER_PARAM,
  'budgetMin',
  'budgetMax',
  'accommodationTypes',
  'stars',
  'boardTypes',
  'vacationTypes',
  HAS_CAR_RENTAL_PARAM,
  COAST_PARAM,
  URBAN_PARAM,
  RURAL_PARAM,
  CENTER_DISTANCE_PARAM,
  BEACH_DISTANCE_PARAM,
  'centerLocation',
  'beachLocation',
  'amenities',
  'seaView',
] as const;

/** Drop every sidebar filter. Search-bar fields (dates, party, airport, sort) stay. */
export function searchParamsWithoutSidebarFilters(source: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(source.toString());
  for (const key of SIDEBAR_FILTER_KEYS) {
    params.delete(key);
  }
  return params;
}

export function searchParamsWithoutFilterChip(source: URLSearchParams, id: string): URLSearchParams {
  const params = new URLSearchParams(source.toString());
  const { kind, value } = splitChipId(id);

  switch (kind) {
    case 'country': {
      const remaining = countriesInUrl(params).filter((entry) => entry !== value);
      setSerialized(params, 'country', remaining.length > 0 ? remaining.join(',') : undefined);
      break;
    }
    case 'region':
      params.delete('region');
      break;
    case 'city':
      params.delete('city');
      break;
    case 'provider':
      params.delete(PROVIDER_FILTER_PARAM);
      break;
    case 'budget':
      params.delete('budgetMin');
      params.delete('budgetMax');
      break;
    case 'accommodation': {
      const remaining = drop(
        parseAccommodationTypesParam(params.get('accommodationTypes')),
        value as AccommodationTypeFilter,
      );
      setSerialized(params, 'accommodationTypes', serializeAccommodationTypesParam(remaining));
      break;
    }
    case 'stars': {
      const remaining = drop(parseStarsParam(params.get('stars')), Number(value));
      setSerialized(params, 'stars', serializeStarsParam(remaining));
      break;
    }
    case 'board': {
      const remaining = drop(
        canonicalizeBoardTypes(params.get('boardTypes')?.split(',').filter(Boolean) || []),
        value as CanonicalBoardType,
      );
      setSerialized(params, 'boardTypes', remaining.length > 0 ? remaining.join(',') : undefined);
      break;
    }
    case 'vacation': {
      const remaining = drop(parseVacationTypesParam(params.get('vacationTypes')), value as VacationType);
      setSerialized(params, 'vacationTypes', serializeVacationTypesParam(remaining));
      break;
    }
    case 'car':
      params.delete(HAS_CAR_RENTAL_PARAM);
      break;
    case 'coast':
      params.delete(COAST_PARAM);
      break;
    case 'urban':
      params.delete(URBAN_PARAM);
      break;
    case 'rural':
      params.delete(RURAL_PARAM);
      break;
    case 'centerDistance': {
      const remaining = drop(
        parseCenterDistanceParam(params.get(CENTER_DISTANCE_PARAM)),
        value as CenterDistance,
      );
      setSerialized(params, CENTER_DISTANCE_PARAM, serializeCenterDistanceParam(remaining));
      break;
    }
    case 'beachDistance': {
      const remaining = drop(
        parseBeachDistanceParam(params.get(BEACH_DISTANCE_PARAM)),
        value as BeachDistance,
      );
      setSerialized(params, BEACH_DISTANCE_PARAM, serializeBeachDistanceParam(remaining));
      break;
    }
    case 'center': {
      const remaining = drop(parseCenterLocationsParam(params.get('centerLocation')), value as CenterLocation);
      setSerialized(params, 'centerLocation', serializeCenterLocationsParam(remaining));
      break;
    }
    case 'beach': {
      const remaining = drop(parseBeachLocationsParam(params.get('beachLocation')), value as BeachLocation);
      setSerialized(params, 'beachLocation', serializeBeachLocationsParam(remaining));
      break;
    }
    case 'amenity': {
      const remaining = drop(parseAmenitiesParam(params.get('amenities')), value as AmenityValue);
      setSerialized(params, 'amenities', serializeAmenitiesParam(remaining));
      break;
    }
    default:
      break;
  }

  return params;
}
