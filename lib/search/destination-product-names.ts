/**
 * Product names are NOT destinations. Some feeds put product labels in the place/region fields
 * ("Bingoreizen Kreta", "Nijlcruise", "Blue Cruises", "Rondreizen", "Fly & Drive Madeira", ...).
 * The offer keeps its real area (Bingoreizen Kreta stays findable through region Kreta); the product
 * label itself must never be offered as a destination in the Destination popup.
 *
 * The exact deny-list below (country + field + value, 42 proven catalog values) is the source of
 * truth. The word-bound pattern is only a guard: a test reports catalog values that look like a
 * product name but are not on the list, so a new feed value is reviewed instead of guessed.
 * Provider independent: no sourceProvider condition, only (country, field, value).
 */
export type ProductNameField = 'city' | 'region' | 'province';

type DenyList = Readonly<Record<string, readonly string[]>>;

const CITY_DENY: DenyList = {
  Egypte: ['Nijlcruise', 'Bingoreizen Egypte'],
  Spanje: ['Cruisereizen', 'Vol Charter pour Mallorca'],
  Turkije: [
    'Bingoreizen Marmaris',
    'Bingoreizen Kusadasi',
    'Blue Cruises Turkse Riviera',
    'Bingoreizen Turkse Riviera',
    'Bingoreizen Bodrum',
    'Rondreizen Turkije',
  ],
  Griekenland: [
    'Bingoreizen Kos',
    'Bingoreizen Lesbos',
    'Bingoreizen Rhodos',
    'Bingoreizen Kreta',
    'Bingoreizen Samos',
    'Bingoreizen Zakynthos',
    'Excursiereizen Parga',
    'Excursiereizen Samos',
    'Excursiereizen Zakynthos',
    'Excursiereizen Lefkas',
    'Excursiereizen Lesbos',
    'Fly & Drive Chalkidiki',
  ],
  Portugal: ['Fly & Drive Madeira', 'Rondreizen Madeira'],
  Marokko: ['Rondreizen Marokko'],
  'Italië': ['Cruisereizen', 'Rondreizen'],
  Gambia: ['Rondreizen'],
  'Argentinië': ['Cruisereizen'],
  'Brazilië': ['Cruisereizen'],
  Duitsland: ['Cruisereizen'],
  Canada: ['Cruisereizen'],
  'Dominicaanse Republiek': ['Cruisereizen'],
};

const REGION_DENY: DenyList = {
  Egypte: ['Nijlcruises'],
  Turkije: ['Blue Cruises', 'Bingoreizen Turkse Riviera', 'Rondreizen'],
  Gambia: ['Rondreizen'],
};

const PROVINCE_DENY: DenyList = {
  Turkije: ['Blue Cruises', 'Bingoreizen Turkse Riviera', 'Rondreizen'],
  Gambia: ['Rondreizen'],
};

export const PRODUCT_DESTINATION_DENYLIST: Readonly<Record<ProductNameField, DenyList>> = {
  city: CITY_DENY,
  region: REGION_DENY,
  province: PROVINCE_DENY,
};

export function isProductDestinationValue(
  country: string,
  field: ProductNameField,
  value: string | undefined | null,
): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return PRODUCT_DESTINATION_DENYLIST[field][country]?.includes(trimmed) ?? false;
}

/** Flat (country, field, value) view of the deny-list (used by guard tests and the directory). */
export function listProductDenyEntries(): Array<{
  country: string;
  field: ProductNameField;
  value: string;
}> {
  const entries: Array<{ country: string; field: ProductNameField; value: string }> = [];
  for (const field of ['city', 'region', 'province'] as const) {
    for (const [country, values] of Object.entries(PRODUCT_DESTINATION_DENYLIST[field])) {
      for (const value of values) {
        entries.push({ country, field, value });
      }
    }
  }
  return entries;
}

/**
 * Word-bound guard pattern (NOT the source of truth). Word boundaries keep real places such as
 * "Turgutreis" (contains "reis") out of the product class.
 */
export const PRODUCT_NAME_GUARD_PATTERN =
  /(^|[\s\-&])(bingoreizen|rondreizen|cruisereizen|nijlcruises?|excursiereizen|blue cruises|fly & drive|vol charter)(?=$|[\s\-&])/i;
