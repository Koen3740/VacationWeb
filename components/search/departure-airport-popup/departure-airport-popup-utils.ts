import type { AirportCountryCode, AirportCountryGroup } from '../../../lib/search/departure-airports';
export {
  formatDepartureAirportLabel,
  formatDepartureAirportOptionLabel,
  formatSelectedDepartureAirportsLabel,
  getPublicPickerCountryGroups,
  listPublicPickerIataCodes,
  parseDepartureAirportsParam,
  serializeDepartureAirportsParam,
  setDepartureAirportsSelection,
  toggleDepartureAirport,
} from '../../../lib/search/departure-airports';

/** Expand country groups that contain a currently selected airport (e.g. on popup open). */
export function getCountriesWithSelectedAirports(
  selectedAirports: readonly string[],
  groups: readonly Pick<AirportCountryGroup, 'countryCode' | 'airports'>[],
): Set<AirportCountryCode> {
  const selectedSet = new Set(selectedAirports.map((code) => code.toUpperCase()));
  const expanded = new Set<AirportCountryCode>();
  for (const group of groups) {
    if (group.airports.some((airport) => selectedSet.has(airport.iata.toUpperCase()))) {
      expanded.add(group.countryCode);
    }
  }
  return expanded;
}

export function toggleCountryExpanded(
  expanded: ReadonlySet<AirportCountryCode>,
  countryCode: AirportCountryCode,
): Set<AirportCountryCode> {
  const next = new Set(expanded);
  if (next.has(countryCode)) {
    next.delete(countryCode);
  } else {
    next.add(countryCode);
  }
  return next;
}
