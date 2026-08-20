/**
 * Existing URL param `departureAirport` — comma-separated IATA/feed codes.
 * Display names are labels for catalog codes, not new airport inventory.
 * IATA remains the internal identity; UI labels come from DEPARTURE_AIRPORT_LABELS.
 */

export type DepartureAirportOption = {
  code: string;
  label: string;
};

export type OfferAirportFields = {
  departureAirport?: string;
  departureAirportCode?: string;
  airport?: string;
};

/** Labels for IATA/feed codes already used in VacationWeb catalog / Receipt maps. */
const DEPARTURE_AIRPORT_LABELS: Record<string, string> = {
  AMS: 'Amsterdam',
  BRU: 'Brussel',
  CGN: 'Keulen',
  CRL: 'Brussel Charleroi',
  DUS: 'Düsseldorf',
  EIN: 'Eindhoven',
  GRQ: 'Groningen',
  LGG: 'Luik',
  LIL: 'Rijsel',
  LUX: 'Luxemburg',
  MST: 'Maastricht',
  NRN: 'Weeze',
  RTM: 'Rotterdam',
};

const CODE_ALIASES: Record<string, string> = {
  'BE-BRU': 'BRU',
  'BE-CRL': 'CRL',
  'DE-CGN': 'CGN',
  'NL-AMS': 'AMS',
  'NL-EIN': 'EIN',
  'NL-MST': 'MST',
  'NL-RTM': 'RTM',
  'BE-LGG': 'LGG',
};

const ISO_COUNTRY_IATA = /^([A-Z]{2})-([A-Z]{3})$/;
const IATA_CODE = /^[A-Z]{3}$/;

/**
 * Canonical IATA identity only.
 * Country ISO (`BE`) and provider place names (`Brussel Zaventem`) are not airport codes.
 */
export function canonicalizeDepartureAirportCode(raw: string | undefined | null): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  const upper = raw.trim().toUpperCase();
  if (CODE_ALIASES[upper]) {
    return CODE_ALIASES[upper];
  }

  const dashed = ISO_COUNTRY_IATA.exec(upper);
  if (dashed?.[2]) {
    return dashed[2];
  }

  if (IATA_CODE.test(upper)) {
    return upper;
  }

  return undefined;
}

export function parseDepartureAirportsParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const code = canonicalizeDepartureAirportCode(part);
    if (!code || seen.has(code.toUpperCase())) {
      continue;
    }
    seen.add(code.toUpperCase());
    out.push(code);
  }
  return out;
}

export function serializeDepartureAirportsParam(selected: string[]): string | undefined {
  const parsed = parseDepartureAirportsParam(selected.join(','));
  return parsed.length > 0 ? parsed.join(',') : undefined;
}

export function toggleDepartureAirport(selected: string[], code: string): string[] {
  const canonical = canonicalizeDepartureAirportCode(code);
  if (!canonical) {
    return [...selected];
  }

  const current = parseDepartureAirportsParam(selected.join(','));
  const key = canonical.toUpperCase();
  const exists = current.some((item) => item.toUpperCase() === key);
  const next = exists
    ? current.filter((item) => item.toUpperCase() !== key)
    : [...current, canonical];
  return next;
}

export function formatDepartureAirportLabel(code: string): string {
  const canonical = canonicalizeDepartureAirportCode(code);
  if (canonical && DEPARTURE_AIRPORT_LABELS[canonical]) {
    return DEPARTURE_AIRPORT_LABELS[canonical];
  }

  const trimmed = code.trim();
  if (canonical) {
    return DEPARTURE_AIRPORT_LABELS[canonical] ?? trimmed;
  }

  return trimmed;
}

/** User-facing picker label: city/airport name only, never the IATA code. */
export function formatDepartureAirportOptionLabel(code: string): string {
  return formatDepartureAirportLabel(code);
}

/**
 * Canonical IATA for an offer.
 * `departureAirportCode` is only used when it is actually an IATA/alias, never a country ISO.
 * Provider `airport` text is not an identity unless it is itself an IATA code.
 */
export function resolveOfferIataAirportCode(offer: OfferAirportFields): string | undefined {
  return (
    canonicalizeDepartureAirportCode(offer.departureAirport) ??
    canonicalizeDepartureAirportCode(offer.departureAirportCode) ??
    canonicalizeDepartureAirportCode(offer.airport)
  );
}

/** VacationWeb display name for Results/Detail. Never returns a raw IATA code. */
export function formatOfferDepartureAirportLabel(offer: OfferAirportFields): string | undefined {
  const iata = resolveOfferIataAirportCode(offer);
  if (!iata) {
    return undefined;
  }

  const mapped = DEPARTURE_AIRPORT_LABELS[iata];
  if (mapped) {
    return mapped;
  }

  return undefined;
}

export function formatSelectedDepartureAirportsLabel(selected: string[]): string {
  const codes = parseDepartureAirportsParam(selected.join(','));
  if (codes.length === 0) {
    return 'Alle luchthavens';
  }

  if (codes.length === 1) {
    return formatDepartureAirportLabel(codes[0] ?? '');
  }

  if (codes.length === 2) {
    return codes.map((code) => formatDepartureAirportLabel(code)).join(', ');
  }

  return `${codes.length} luchthavens`;
}

export function offerAirportTokens(offer: OfferAirportFields): string[] {
  const tokens = new Set<string>();
  for (const raw of [offer.departureAirport, offer.departureAirportCode, offer.airport]) {
    const canonical = canonicalizeDepartureAirportCode(raw);
    if (canonical) {
      tokens.add(canonical.toUpperCase());
    }
  }
  return [...tokens];
}

export function offerMatchesDepartureAirports(
  offer: OfferAirportFields,
  selected: string[],
): boolean {
  const wanted = parseDepartureAirportsParam(selected.join(','));
  if (wanted.length === 0) {
    return true;
  }

  const tokens = offerAirportTokens(offer);
  if (tokens.length === 0) {
    return false;
  }

  return wanted.some((code) => tokens.includes(code.toUpperCase()));
}
