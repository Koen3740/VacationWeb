/**
 * Provider ↔ canonical IATA airport mapping (inbound / outbound).
 *
 * Canonical identity remains IATA (`lib/search/canonical-airports.ts`).
 * Provider raw → VacationWeb IATA is inbound.
 * VacationWeb IATA → provider request form is outbound (separate).
 *
 * Only proven values are mapped. Never invent airports.
 *
 * Evidence: docs/research/airport-architecture/provider-airport-mapping.md
 * Feed sample: scripts/_sample_provider_airports.ts (2026-08-31)
 */

import {
  getCanonicalAirportAliasMap,
  getCanonicalAirportByIata,
  isValidCanonicalIata,
} from './canonical-airports';

export type AirportMappingStatus =
  | 'MAPPED'
  | 'PARTIALLY_MAPPED'
  | 'UNMAPPED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE'
  | 'CANONICAL_AIRPORT_MISSING';

export type AirportMappingDirection = 'inbound' | 'outbound';

export type AirportProviderId =
  | 'corendon'
  | 'sunweb'
  | 'eliza'
  | 'vakanties_nl'
  | 'de_jong_intra'
  | 'traveldeal';

export type ProviderAirportMappingResult = {
  provider: AirportProviderId | 'generic';
  direction: AirportMappingDirection;
  rawValue: string;
  canonicalIata?: string;
  outboundValue?: string;
  source?: string;
  status: AirportMappingStatus;
  note?: string;
};

export type ProviderAirportMappingRow = {
  provider: AirportProviderId;
  direction: AirportMappingDirection;
  rawValue: string;
  canonicalIata?: string;
  outboundValue?: string;
  source: string;
  status: AirportMappingStatus;
  note?: string;
};

const IATA_CODE = /^[A-Z]{3}$/;
const ISO_COUNTRY_IATA = /^([A-Z]{2})-([A-Z]{3})$/;
const ISO_COUNTRY_ONLY = /^[A-Z]{2}$/;

/**
 * Proven Sunweb feed `airport` place names → IATA (Accomodatie feed sample 2026-08-31).
 * Lookup key = trim + upper case (Unicode).
 */
const PROVEN_PLACE_NAME_TO_IATA: Record<string, string> = {
  AMSTERDAM: 'AMS',
  'BRUSSEL CHARLEROI': 'CRL',
  'BRUSSEL ZAVENTEM': 'BRU',
  DÜSSELDORF: 'DUS',
  DUSSELDORF: 'DUS',
  EINDHOVEN: 'EIN',
  'KÖLN/BONN': 'CGN',
  'KOLN/BONN': 'CGN',
  'KEULEN/BONN': 'CGN',
  LILLE: 'LIL',
  LUXEMBURG: 'LUX',
  LUXEMBOURG: 'LUX',
  ROTTERDAM: 'RTM',
  WEEZE: 'NRN',
};

/** Sentinels that are not airports. */
const ABSENT_SENTINELS = new Set(['NONE', 'NULL', 'N/A', '-', '']);

/**
 * Declared mapping rows for documentation / onboarding (not an exhaustive runtime table).
 * Runtime resolution uses helpers below + registry aliases.
 */
export const PROVIDER_AIRPORT_MAPPING_ROWS: readonly ProviderAirportMappingRow[] = [
  // Corendon inbound — feed IATA (BENL+NL sample)
  ...(['AMS', 'BRU', 'CGN', 'CRL', 'DUS', 'EIN', 'GRQ', 'MST', 'NRN', 'RTM'] as const).map(
    (iata) =>
      ({
        provider: 'corendon' as const,
        direction: 'inbound' as const,
        rawValue: iata,
        canonicalIata: iata,
        source: 'feed:iataDeparture (Corendon BENL/NL sample 2026-08-31)',
        status: 'MAPPED' as const,
      }),
  ),
  {
    provider: 'corendon',
    direction: 'inbound',
    rawValue: 'BE|NL|DE',
    source: 'feed:isoCodeDeparture',
    status: 'NOT_APPLICABLE',
    note: 'Country ISO only — not an airport identity',
  },
  {
    provider: 'corendon',
    direction: 'inbound',
    rawValue: 'BRUCFU',
    canonicalIata: 'BRU',
    source: 'deeplink fragment airportRoute (first 3 chars)',
    status: 'MAPPED',
    note: 'Pattern: airportRoute[0..3] = IATA when length≥3',
  },
  {
    provider: 'corendon',
    direction: 'outbound',
    rawValue: 'airportRoute',
    source: 'live:lowestpricesacco trip match',
    status: 'NOT_APPLICABLE',
    note: 'Live needs full airportRoute from offer fragment (e.g. BRUCFU), not IATA alone',
  },

  // Sunweb inbound
  ...(['AMS', 'BRU', 'CGN', 'CRL', 'DUS', 'EIN', 'LIL', 'LUX', 'NRN', 'RTM'] as const).map(
    (iata) =>
      ({
        provider: 'sunweb' as const,
        direction: 'inbound' as const,
        rawValue: iata,
        canonicalIata: iata,
        source: 'feed:IsoCodeDeparture (IATA values despite field name) + URL DepartureAirport[0]',
        status: 'MAPPED' as const,
      }),
  ),
  ...Object.entries(PROVEN_PLACE_NAME_TO_IATA).map(([raw, iata]) => ({
    provider: 'sunweb' as const,
    direction: 'inbound' as const,
    rawValue: raw,
    canonicalIata: iata,
    source: 'feed:airport place name (Sunweb Zon Accomodatie sample 2026-08-31)',
    status: 'MAPPED' as const,
  })),
  {
    provider: 'sunweb',
    direction: 'inbound',
    rawValue: 'none',
    source: 'merge sentinel / SelfDrive',
    status: 'NOT_APPLICABLE',
    note: 'Absent airport slot — not a canonical airport',
  },
  {
    provider: 'sunweb',
    direction: 'outbound',
    rawValue: 'BRU',
    canonicalIata: 'BRU',
    outboundValue: 'BRU',
    source: 'live:DepartureAirport[0]',
    status: 'MAPPED',
  },

  // Eliza inbound / outbound
  ...(['AMS', 'BRU', 'CGN', 'CRL', 'DUS', 'EIN', 'LIL', 'LUX', 'NRN', 'RTM'] as const).map(
    (iata) =>
      ({
        provider: 'eliza' as const,
        direction: 'inbound' as const,
        rawValue: iata,
        canonicalIata: iata,
        source: 'URL DepartureAirport[0] (wins) / feed property airport',
        status: 'MAPPED' as const,
      }),
  ),
  {
    provider: 'eliza',
    direction: 'outbound',
    rawValue: 'BRU',
    canonicalIata: 'BRU',
    outboundValue: 'BRU',
    source: 'live:DepartureAirport[0]',
    status: 'MAPPED',
  },

  // Future candidates — no structured airport in audited feeds
  {
    provider: 'vakanties_nl',
    direction: 'inbound',
    rawValue: '',
    source: 'TT feed Vakanties.nl - algemeen.xml (2026-08-31)',
    status: 'UNMAPPED',
    note: 'No airport/IATA properties; only departureDate among airportish names. Mapping not possible with available feed data — additional route required.',
  },
  {
    provider: 'de_jong_intra',
    direction: 'inbound',
    rawValue: '',
    source: 'TT feed DeJongIntraVakanties_Algemeen.xml + prior research',
    status: 'UNMAPPED',
    note: 'No structured departureAirport; free-text hits only. Mapping not possible with available provider data — additional route required.',
  },
  {
    provider: 'traveldeal',
    direction: 'inbound',
    rawValue: '',
    source: 'TT Traveldeal Algemeen Datafeed / Algemeen.xml',
    status: 'UNMAPPED',
    note: 'No airport fields in audited feeds. Mapping not possible with available provider data — additional route required.',
  },
];

function normalizeRawKey(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Shared inbound resolver used by generic canonicalize + provider helpers.
 * Returns MAPPED only for known aliases / place names / registry IATA / XX-IATA → registry.
 * Bare IATA not in registry → CANONICAL_AIRPORT_MISSING (still exposes iata for diagnostics).
 * Unknown text → UNKNOWN. Empty/sentinel → UNMAPPED / NOT_APPLICABLE.
 */
export function resolveInboundAirportRaw(
  raw: string | undefined | null,
  options: { provider?: AirportProviderId; source?: string } = {},
): ProviderAirportMappingResult {
  const provider = options.provider ?? 'generic';
  const source = options.source;
  if (raw == null || !String(raw).trim()) {
    return {
      provider,
      direction: 'inbound',
      rawValue: '',
      source,
      status: 'UNMAPPED',
      note: 'Empty raw value',
    };
  }

  const original = String(raw).trim();
  const upper = normalizeRawKey(original);

  if (ABSENT_SENTINELS.has(upper)) {
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      source,
      status: 'NOT_APPLICABLE',
      note: 'Absent-airport sentinel',
    };
  }

  // Country ISO alone (Corendon isoCodeDeparture)
  if (ISO_COUNTRY_ONLY.test(upper) && !IATA_CODE.test(upper)) {
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      source,
      status: 'NOT_APPLICABLE',
      note: 'Country ISO is not an airport identity',
    };
  }

  const registryAliases = getCanonicalAirportAliasMap();
  if (registryAliases[upper]) {
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      canonicalIata: registryAliases[upper],
      source,
      status: 'MAPPED',
    };
  }

  if (PROVEN_PLACE_NAME_TO_IATA[upper]) {
    const iata = PROVEN_PLACE_NAME_TO_IATA[upper];
    if (!isValidCanonicalIata(iata)) {
      return {
        provider,
        direction: 'inbound',
        rawValue: original,
        canonicalIata: iata,
        source,
        status: 'CANONICAL_AIRPORT_MISSING',
        note: `Place name maps to ${iata} which is not in canonical registry`,
      };
    }
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      canonicalIata: iata,
      source,
      status: 'MAPPED',
    };
  }

  const dashed = ISO_COUNTRY_IATA.exec(upper);
  if (dashed?.[2]) {
    const iata = dashed[2];
    if (isValidCanonicalIata(iata)) {
      return {
        provider,
        direction: 'inbound',
        rawValue: original,
        canonicalIata: iata,
        source,
        status: 'MAPPED',
      };
    }
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      canonicalIata: iata,
      source,
      status: 'CANONICAL_AIRPORT_MISSING',
      note: `${upper} → ${iata} not in canonical registry`,
    };
  }

  if (IATA_CODE.test(upper)) {
    if (isValidCanonicalIata(upper)) {
      return {
        provider,
        direction: 'inbound',
        rawValue: original,
        canonicalIata: upper,
        source,
        status: 'MAPPED',
      };
    }
    return {
      provider,
      direction: 'inbound',
      rawValue: original,
      canonicalIata: upper,
      source,
      status: 'CANONICAL_AIRPORT_MISSING',
      note: `IATA ${upper} not in canonical registry — do not auto-extend registry`,
    };
  }

  return {
    provider,
    direction: 'inbound',
    rawValue: original,
    source,
    status: 'UNKNOWN',
    note: 'Unrecognized airport representation — not mapped',
  };
}

/**
 * Corendon deeplink airportRoute (e.g. BRUCFU) → canonical IATA (first 3 letters).
 */
export function mapCorendonAirportRouteInbound(
  airportRoute: string | undefined | null,
): ProviderAirportMappingResult {
  if (airportRoute == null || !String(airportRoute).trim()) {
    return {
      provider: 'corendon',
      direction: 'inbound',
      rawValue: '',
      source: 'airportRoute',
      status: 'UNMAPPED',
      note: 'Empty airportRoute',
    };
  }
  const raw = String(airportRoute).trim().toUpperCase();
  if (raw.length < 3) {
    return {
      provider: 'corendon',
      direction: 'inbound',
      rawValue: raw,
      source: 'airportRoute',
      status: 'UNKNOWN',
      note: 'airportRoute shorter than 3 characters',
    };
  }
  const prefix = raw.slice(0, 3);
  return resolveInboundAirportRaw(prefix, {
    provider: 'corendon',
    source: `airportRoute:${raw}`,
  });
}

export function mapProviderAirportInbound(
  provider: AirportProviderId,
  raw: string | undefined | null,
  source?: string,
): ProviderAirportMappingResult {
  if (provider === 'vakanties_nl' || provider === 'de_jong_intra' || provider === 'traveldeal') {
    if (raw == null || !String(raw).trim()) {
      return {
        provider,
        direction: 'inbound',
        rawValue: '',
        source,
        status: 'UNMAPPED',
        note: 'No structured airport value in audited provider feeds — additional route required; provider remains integration candidate',
      };
    }
    // If somehow a raw value appears later, still try generic resolve — do not invent.
    return resolveInboundAirportRaw(raw, { provider, source });
  }

  if (provider === 'corendon' && raw && String(raw).trim().length > 3 && !IATA_CODE.test(normalizeRawKey(String(raw)))) {
    // Likely airportRoute (BRUCFU) rather than bare IATA
    const asRoute = mapCorendonAirportRouteInbound(raw);
    if (asRoute.status === 'MAPPED' || asRoute.status === 'CANONICAL_AIRPORT_MISSING') {
      return asRoute;
    }
  }

  return resolveInboundAirportRaw(raw, { provider, source });
}

/**
 * Outbound: VacationWeb canonical IATA → provider request value.
 * Separate from inbound — do not reverse-guess place names.
 */
export function mapProviderAirportOutbound(
  provider: AirportProviderId,
  canonicalIata: string | undefined | null,
): ProviderAirportMappingResult {
  const raw = canonicalIata?.trim() ?? '';
  if (!raw) {
    return {
      provider,
      direction: 'outbound',
      rawValue: '',
      status: 'UNMAPPED',
      note: 'Empty canonical IATA',
    };
  }

  const upper = normalizeRawKey(raw);
  if (!IATA_CODE.test(upper)) {
    return {
      provider,
      direction: 'outbound',
      rawValue: raw,
      status: 'UNKNOWN',
      note: 'Outbound expects canonical IATA',
    };
  }

  if (!getCanonicalAirportByIata(upper)) {
    return {
      provider,
      direction: 'outbound',
      rawValue: upper,
      canonicalIata: upper,
      status: 'CANONICAL_AIRPORT_MISSING',
      note: 'IATA not in canonical registry',
    };
  }

  switch (provider) {
    case 'sunweb':
    case 'eliza':
      return {
        provider,
        direction: 'outbound',
        rawValue: upper,
        canonicalIata: upper,
        outboundValue: upper,
        source: 'DepartureAirport[0]',
        status: 'MAPPED',
      };
    case 'corendon':
      return {
        provider,
        direction: 'outbound',
        rawValue: upper,
        canonicalIata: upper,
        source: 'live airportRoute',
        status: 'NOT_APPLICABLE',
        note: 'Corendon live matching requires offer airportRoute (e.g. BRUCFU), not IATA alone',
      };
    case 'vakanties_nl':
    case 'de_jong_intra':
    case 'traveldeal':
      return {
        provider,
        direction: 'outbound',
        rawValue: upper,
        canonicalIata: upper,
        status: 'UNMAPPED',
        note: 'No proven live outbound airport representation — additional route required',
      };
    default:
      return {
        provider,
        direction: 'outbound',
        rawValue: upper,
        status: 'UNKNOWN',
      };
  }
}

/** Proven place-name aliases for generic canonicalize (Sunweb feed evidence). */
export function getProvenPlaceNameInboundMap(): Readonly<Record<string, string>> {
  return PROVEN_PLACE_NAME_TO_IATA;
}

export function listAirportCompleteProviders(): AirportProviderId[] {
  return ['corendon', 'sunweb', 'eliza'];
}

export function listAirportFollowUpProviders(): AirportProviderId[] {
  return ['vakanties_nl', 'de_jong_intra', 'traveldeal'];
}
