import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';

export type DestinationCountryOption = {
  name: string;
  count: number;
};

export const POPULAR_COUNTRY_NAMES = [
  'Spanje',
  'Griekenland',
  'Turkije',
  'Canarische Eilanden',
  'Italië',
  'Portugal',
  'Egypte',
  'Marokko',
  'Tunesië',
  'Albanië',
] as const;

const COUNTRY_FLAG_CODES: Record<string, string> = {
  Albanië: 'AL',
  Aruba: 'AW',
  Barbados: 'BB',
  Bonaire: 'BQ',
  Brazilië: 'BR',
  Bulgarije: 'BG',
  'Canarische Eilanden': 'ES',
  'Costa Rica': 'CR',
  Curaçao: 'CW',
  Cyprus: 'CY',
  Denemarken: 'DK',
  'Dominicaanse Republiek': 'DO',
  Duitsland: 'DE',
  Egypte: 'EG',
  Estland: 'EE',
  Finland: 'FI',
  Frankrijk: 'FR',
  Gambia: 'GM',
  Griekenland: 'GR',
  Hongarije: 'HU',
  Ierland: 'IE',
  IJsland: 'IS',
  Indonesië: 'ID',
  Italië: 'IT',
  Jamaica: 'JM',
  'Kaapverdische Eilanden': 'CV',
  Kroatië: 'HR',
  Letland: 'LV',
  Litouwen: 'LT',
  Malta: 'MT',
  Marokko: 'MA',
  Mauritius: 'MU',
  Mexico: 'MX',
  Montenegro: 'ME',
  Noorwegen: 'NO',
  Oman: 'OM',
  Oostenrijk: 'AT',
  Polen: 'PL',
  Portugal: 'PT',
  Qatar: 'QA',
  Seychellen: 'SC',
  'Sint Maarten': 'SX',
  Slovenië: 'SI',
  Spanje: 'ES',
  Tanzania: 'TZ',
  Thailand: 'TH',
  Tsjechië: 'CZ',
  Tunesië: 'TN',
  Turkije: 'TR',
  'Verenigd Koninkrijk': 'GB',
  'Verenigde Arabische Emiraten': 'AE',
  'Verenigde Staten': 'US',
  'Zuid-Afrika': 'ZA',
  Zweden: 'SE',
  Zwitserland: 'CH',
};

export function getCountryFlagCode(country: string): string | undefined {
  return COUNTRY_FLAG_CODES[canonicalizeCountryName(country)];
}

export function formatOfferCount(count: number): string {
  return count.toLocaleString('nl-NL');
}

export function loadDestinationCountries(
  countryCounts: Record<string, number>,
): DestinationCountryOption[] {
  return loadFilterOptions().countries.map((name) => ({
    name,
    count: countryCounts[name] ?? 0,
  }));
}

export function loadPopularDestinationCountries(
  countries: DestinationCountryOption[],
): DestinationCountryOption[] {
  const byName = new Map(countries.map((country) => [country.name, country]));

  return POPULAR_COUNTRY_NAMES.flatMap((name) => {
    const country = byName.get(name);
    return country ? [country] : [];
  });
}

export function filterCountriesByQuery(
  countries: DestinationCountryOption[],
  query: string,
): DestinationCountryOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return countries;
  }

  return countries.filter((country) => country.name.toLowerCase().includes(normalized));
}

export function formatSelectedCountriesLabel(countries: string[]): string {
  if (countries.length === 0) {
    return 'Bestemming kiezen';
  }

  if (countries.length === 1) {
    return countries[0] ?? 'Bestemming kiezen';
  }

  return `${countries.length} bestemmingen`;
}
