import directoryJson from '@/data/destination-directory.json';
import indexJson from '@/data/destination-index.json';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { normalizePlaceText } from '@/lib/search/destination-mapping';
import type { GeoTarget, ResultsLink } from '@/content/destinations/types';

type DirectoryPlace = { c: string; n: string; v?: string };
type DirectoryArea = { c: string; n: string };
type DirectoryFile = {
  countries: string[];
  areas: DirectoryArea[];
  places: DirectoryPlace[];
};
type IndexFile = {
  filterOptions: {
    countries: string[];
    regionsByCountry: Record<string, string[]>;
  };
};

const directory = directoryJson as DirectoryFile;
const index = indexJson as IndexFile;

const countries = new Set<string>();
for (const name of directory.countries) countries.add(canonicalizeCountryName(name));
for (const name of index.filterOptions.countries) countries.add(canonicalizeCountryName(name));

const areas = new Set<string>();
function addArea(country: string, region: string) {
  const canonicalCountry = canonicalizeCountryName(country);
  const canonicalRegion = canonicalizeRegionName(region);
  if (canonicalCountry && canonicalRegion) {
    areas.add(`${canonicalCountry}|${canonicalRegion}`);
  }
}
for (const area of directory.areas) addArea(area.c, area.n);
for (const [country, regions] of Object.entries(index.filterOptions.regionsByCountry)) {
  for (const region of regions) addArea(country, region);
}

/** country|normalized place name → city value for the results URL. */
const places = new Map<string, string>();
for (const place of directory.places) {
  const country = canonicalizeCountryName(place.c);
  const urlName = place.v?.trim() || place.n;
  places.set(`${country}|${normalizePlaceText(place.n)}`, urlName);
  if (place.v) places.set(`${country}|${normalizePlaceText(place.v)}`, urlName);
}

export function isSupportedCountry(country: string): boolean {
  return countries.has(canonicalizeCountryName(country));
}

export function isSupportedArea(country: string, region: string): boolean {
  return areas.has(`${canonicalizeCountryName(country)}|${canonicalizeRegionName(region)}`);
}

/** URL city value when this place is in the catalog, otherwise null. */
export function supportedPlaceName(country: string, city: string): string | null {
  return places.get(`${canonicalizeCountryName(country)}|${normalizePlaceText(city)}`) ?? null;
}

export function isSupportedPlace(country: string, city: string): boolean {
  return supportedPlaceName(country, city) !== null;
}

export function buildResultsHref(parts: { country: string; region?: string; city?: string }): string {
  const params = new URLSearchParams();
  params.set('country', parts.country);
  if (parts.region) params.set('region', parts.region);
  if (parts.city) params.set('city', parts.city);
  return `/results?${params.toString()}`;
}

/**
 * Results URL for a geo target. A city or region that we do not sell returns null
 * (it is not widened into a broader filter).
 */
export function resolveGeoHref(target: GeoTarget): string | null {
  const country = canonicalizeCountryName(target.country.trim());
  if (!country || !isSupportedCountry(country)) return null;
  if (target.city) {
    const city = supportedPlaceName(country, target.city);
    if (!city) return null;
    return buildResultsHref({ country, city });
  }
  if (target.region) {
    const region = canonicalizeRegionName(target.region);
    if (!isSupportedArea(country, region)) return null;
    return buildResultsHref({ country, region });
  }
  return buildResultsHref({ country });
}

export function resolveResultsLink(link: ResultsLink): { href: string; label: string } | null {
  const primary = resolveGeoHref(link.geo);
  if (primary) return { href: primary, label: link.label };
  if (link.fallback) {
    const fallback = resolveGeoHref(link.fallback.geo);
    if (fallback) return { href: fallback, label: link.fallback.label };
  }
  return null;
}
