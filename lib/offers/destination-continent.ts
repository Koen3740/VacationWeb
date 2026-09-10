import { canonicalizeCountryName } from '@/lib/offers/canonical-country';

/** Visual-only continent labels for /bestemmingen grouping. Not a destination source of truth. */
export type DestinationContinent =
  | 'Europa'
  | 'Afrika'
  | 'Azië'
  | 'Midden-Oosten'
  | 'Caribisch gebied'
  | 'Noord-Amerika'
  | 'Zuid-Amerika'
  | 'Oceanië'
  | 'Overig';

export const DESTINATION_CONTINENT_ORDER: readonly DestinationContinent[] = [
  'Europa',
  'Afrika',
  'Azië',
  'Midden-Oosten',
  'Caribisch gebied',
  'Noord-Amerika',
  'Zuid-Amerika',
  'Oceanië',
  'Overig',
] as const;

/** Canonical Dutch country name → continent for presentation only. */
const COUNTRY_CONTINENT: Record<string, DestinationContinent> = {
  Albanië: 'Europa',
  Argentinië: 'Zuid-Amerika',
  Aruba: 'Caribisch gebied',
  Barbados: 'Caribisch gebied',
  Bonaire: 'Caribisch gebied',
  Brazilië: 'Zuid-Amerika',
  Bulgarije: 'Europa',
  'Canarische Eilanden': 'Europa',
  'Costa Rica': 'Noord-Amerika',
  Curaçao: 'Caribisch gebied',
  Cyprus: 'Europa',
  Denemarken: 'Europa',
  'Dominicaanse Republiek': 'Caribisch gebied',
  Duitsland: 'Europa',
  Egypte: 'Afrika',
  Estland: 'Europa',
  Finland: 'Europa',
  Frankrijk: 'Europa',
  Gambia: 'Afrika',
  Griekenland: 'Europa',
  Hongarije: 'Europa',
  Ierland: 'Europa',
  IJsland: 'Europa',
  Indonesië: 'Azië',
  Italië: 'Europa',
  Jamaica: 'Caribisch gebied',
  'Kaapverdische Eilanden': 'Afrika',
  Kroatië: 'Europa',
  Letland: 'Europa',
  Litouwen: 'Europa',
  Malta: 'Europa',
  Marokko: 'Afrika',
  Mauritius: 'Afrika',
  Mexico: 'Noord-Amerika',
  Montenegro: 'Europa',
  Noorwegen: 'Europa',
  Oman: 'Midden-Oosten',
  Oostenrijk: 'Europa',
  Polen: 'Europa',
  Portugal: 'Europa',
  Qatar: 'Midden-Oosten',
  Seychellen: 'Afrika',
  'Sint Maarten': 'Caribisch gebied',
  Slovenië: 'Europa',
  Spanje: 'Europa',
  Tanzania: 'Afrika',
  Thailand: 'Azië',
  Tsjechië: 'Europa',
  Tunesië: 'Afrika',
  Turkije: 'Europa',
  'Verenigd Koninkrijk': 'Europa',
  'Verenigde Arabische Emiraten': 'Midden-Oosten',
  'Verenigde Staten': 'Noord-Amerika',
  'Zuid-Afrika': 'Afrika',
  Zweden: 'Europa',
  Zwitserland: 'Europa',
};

export function resolveDestinationContinent(country: string): DestinationContinent {
  const canonical = canonicalizeCountryName(country);
  return COUNTRY_CONTINENT[canonical] ?? 'Overig';
}

export type DestinationContinentGroup = {
  continent: DestinationContinent;
  countries: string[];
};

/** Group catalog countries under visual continent headings; empty continents omitted. */
export function groupCountriesByContinent(countries: readonly string[]): DestinationContinentGroup[] {
  const buckets = new Map<DestinationContinent, string[]>();

  for (const country of countries) {
    const continent = resolveDestinationContinent(country);
    const list = buckets.get(continent) ?? [];
    list.push(country);
    buckets.set(continent, list);
  }

  return DESTINATION_CONTINENT_ORDER.flatMap((continent) => {
    const list = buckets.get(continent);
    if (!list?.length) {
      return [];
    }
    return [
      {
        continent,
        countries: [...list].sort((left, right) => left.localeCompare(right, 'nl')),
      },
    ];
  });
}
