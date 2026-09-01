/**
 * VacationWeb canonical airport registry (product domain layer).
 *
 * IATA is the identity. Country grouping is for the public picker only.
 * Provider inbound/outbound mappings are intentionally NOT defined here.
 *
 * DE/FR entries are an explicit managed allowlist (border-relevant), not a
 * full national airport inventory. Distance is not computed at runtime.
 *
 * Research: docs/research/airport-architecture/airport-provider-analysis.md
 */

export type AirportCountryCode = 'BE' | 'NL' | 'DE' | 'FR' | 'LU';

export type CanonicalAirport = {
  /** Canonical identity — IATA. */
  iata: string;
  countryCode: AirportCountryCode;
  displayNameNl: string;
  /** Feed/Receipt-style aliases that canonicalize to this IATA. */
  aliases: readonly string[];
  /** When true, airport appears in the public land→airport picker. */
  enabled: boolean;
};

export type AirportCountryGroup = {
  countryCode: AirportCountryCode;
  displayNameNl: string;
  airports: readonly CanonicalAirport[];
};

/** Display order for the land→airport picker. */
export const AIRPORT_COUNTRY_ORDER: readonly AirportCountryCode[] = [
  'BE',
  'NL',
  'DE',
  'FR',
  'LU',
] as const;

export const AIRPORT_COUNTRY_LABELS_NL: Record<AirportCountryCode, string> = {
  BE: 'België',
  NL: 'Nederland',
  DE: 'Duitsland',
  FR: 'Frankrijk',
  LU: 'Luxemburg',
};

/**
 * Managed VacationWeb departure-airport inventory.
 * Not derived from data/filter-options.json.
 */
export const CANONICAL_AIRPORTS: readonly CanonicalAirport[] = [
  // België — relevant commercial departure airports
  {
    iata: 'BRU',
    countryCode: 'BE',
    displayNameNl: 'Brussel',
    aliases: ['BE-BRU'],
    enabled: true,
  },
  {
    iata: 'CRL',
    countryCode: 'BE',
    displayNameNl: 'Brussel Charleroi',
    aliases: ['BE-CRL'],
    enabled: true,
  },
  {
    iata: 'ANR',
    countryCode: 'BE',
    displayNameNl: 'Antwerpen',
    aliases: ['BE-ANR'],
    enabled: true,
  },
  {
    iata: 'OST',
    countryCode: 'BE',
    displayNameNl: 'Oostende',
    aliases: ['BE-OST'],
    enabled: true,
  },
  {
    iata: 'LGG',
    countryCode: 'BE',
    displayNameNl: 'Luik',
    aliases: ['BE-LGG'],
    enabled: true,
  },

  // Nederland — relevant commercial departure airports
  {
    iata: 'AMS',
    countryCode: 'NL',
    displayNameNl: 'Amsterdam',
    aliases: ['NL-AMS'],
    enabled: true,
  },
  {
    iata: 'EIN',
    countryCode: 'NL',
    displayNameNl: 'Eindhoven',
    aliases: ['NL-EIN'],
    enabled: true,
  },
  {
    iata: 'RTM',
    countryCode: 'NL',
    displayNameNl: 'Rotterdam',
    aliases: ['NL-RTM'],
    enabled: true,
  },
  {
    iata: 'GRQ',
    countryCode: 'NL',
    displayNameNl: 'Groningen',
    aliases: ['NL-GRQ'],
    enabled: true,
  },
  {
    iata: 'MST',
    countryCode: 'NL',
    displayNameNl: 'Maastricht',
    aliases: ['NL-MST'],
    enabled: true,
  },

  // Duitsland — explicit border-relevant allowlist (~1–2h from BE/NL border).
  // Only airports already evidenced in VW catalog/labels/Corendon context:
  // DUS, CGN, NRN. No full DE inventory.
  {
    iata: 'DUS',
    countryCode: 'DE',
    displayNameNl: 'Düsseldorf',
    aliases: ['DE-DUS'],
    enabled: true,
  },
  {
    iata: 'CGN',
    countryCode: 'DE',
    displayNameNl: 'Keulen/Bonn',
    aliases: ['DE-CGN'],
    enabled: true,
  },
  {
    iata: 'NRN',
    countryCode: 'DE',
    displayNameNl: 'Weeze',
    aliases: ['DE-NRN'],
    enabled: true,
  },

  // Frankrijk — explicit border-relevant allowlist
  {
    iata: 'LIL',
    countryCode: 'FR',
    displayNameNl: 'Rijsel',
    aliases: ['FR-LIL'],
    enabled: true,
  },

  // Luxemburg
  {
    iata: 'LUX',
    countryCode: 'LU',
    displayNameNl: 'Luxemburg',
    aliases: ['LU-LUX'],
    enabled: true,
  },
] as const;

const IATA_RE = /^[A-Z]{3}$/;

function buildAliasMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const airport of CANONICAL_AIRPORTS) {
    for (const alias of airport.aliases) {
      map[alias.toUpperCase()] = airport.iata;
    }
  }
  return map;
}

function buildByIata(): Map<string, CanonicalAirport> {
  const map = new Map<string, CanonicalAirport>();
  for (const airport of CANONICAL_AIRPORTS) {
    map.set(airport.iata, airport);
  }
  return map;
}

const BY_IATA = buildByIata();
const ALIAS_TO_IATA = buildAliasMap();

export function getCanonicalAirportAliasMap(): Readonly<Record<string, string>> {
  return ALIAS_TO_IATA;
}

export function getCanonicalAirportByIata(iata: string): CanonicalAirport | undefined {
  return BY_IATA.get(iata.trim().toUpperCase());
}

export function getCanonicalAirportDisplayName(iata: string): string | undefined {
  return getCanonicalAirportByIata(iata)?.displayNameNl;
}

/** All enabled airports for the public picker, flat IATA list (stable country order). */
export function listPublicPickerIataCodes(): string[] {
  return getPublicPickerCountryGroups().flatMap((group) =>
    group.airports.map((airport) => airport.iata),
  );
}

/** Land → luchthaven tree for the public picker. */
export function getPublicPickerCountryGroups(): AirportCountryGroup[] {
  return AIRPORT_COUNTRY_ORDER.map((countryCode) => ({
    countryCode,
    displayNameNl: AIRPORT_COUNTRY_LABELS_NL[countryCode],
    airports: CANONICAL_AIRPORTS.filter(
      (airport) => airport.enabled && airport.countryCode === countryCode,
    ),
  })).filter((group) => group.airports.length > 0);
}

export function isValidCanonicalIata(iata: string): boolean {
  return IATA_RE.test(iata.trim().toUpperCase()) && BY_IATA.has(iata.trim().toUpperCase());
}

export function assertCanonicalAirportRegistryInvariants(): void {
  const seen = new Set<string>();
  for (const airport of CANONICAL_AIRPORTS) {
    if (!IATA_RE.test(airport.iata)) {
      throw new Error(`Invalid IATA: ${airport.iata}`);
    }
    if (!AIRPORT_COUNTRY_ORDER.includes(airport.countryCode)) {
      throw new Error(`Invalid countryCode for ${airport.iata}: ${airport.countryCode}`);
    }
    if (seen.has(airport.iata)) {
      throw new Error(`Duplicate IATA: ${airport.iata}`);
    }
    seen.add(airport.iata);
  }
}
