/**
 * Existing URL param `departureAirport` — comma-separated IATA/feed codes.
 * Display names and public picker inventory come from the canonical airport registry.
 * IATA remains the internal identity. Provider mappings live in provider-airport-mapping.ts.
 */

import {
  getCanonicalAirportAliasMap,
  getCanonicalAirportDisplayName,
  listPublicPickerIataCodes,
} from './canonical-airports';
import { resolveInboundAirportRaw } from './provider-airport-mapping';

export type DepartureAirportOption = {
  code: string;
  label: string;
};

export type OfferAirportFields = {
  departureAirport?: string;
  departureAirportCode?: string;
  airport?: string;
};

export {
  AIRPORT_COUNTRY_LABELS_NL,
  AIRPORT_COUNTRY_ORDER,
  CANONICAL_AIRPORTS,
  getPublicPickerCountryGroups,
  listPublicPickerIataCodes,
  type AirportCountryCode,
  type AirportCountryGroup,
  type CanonicalAirport,
} from './canonical-airports';

export {
  mapCorendonAirportRouteInbound,
  mapProviderAirportInbound,
  mapProviderAirportOutbound,
  resolveInboundAirportRaw,
  type AirportMappingStatus,
  type AirportProviderId,
  type ProviderAirportMappingResult,
} from './provider-airport-mapping';

const IATA_CODE = /^[A-Z]{3}$/;

/**
 * Canonical IATA identity only.
 * Country ISO (`BE`) and unknown provider place names are not airport codes.
 * Proven place names (e.g. Sunweb feed) and XX-IATA aliases map to IATA.
 *
 * Bare IATA not in the public registry is still returned (filter identity /
 * backwards compatibility) — use resolveInboundAirportRaw for status.
 */
export function canonicalizeDepartureAirportCode(raw: string | undefined | null): string | undefined {
  const resolved = resolveInboundAirportRaw(raw);
  if (resolved.status === 'MAPPED' && resolved.canonicalIata) {
    return resolved.canonicalIata;
  }
  // Preserve prior behaviour: any syntactically valid IATA remains an identity token
  // even when not yet in the product registry (do not silently remap to another airport).
  if (resolved.canonicalIata && IATA_CODE.test(resolved.canonicalIata)) {
    return resolved.canonicalIata;
  }
  if (raw?.trim() && IATA_CODE.test(raw.trim().toUpperCase())) {
    return raw.trim().toUpperCase();
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

/** Select or clear every airport in `codes` relative to `selected`. */
export function setDepartureAirportsSelection(
  selected: string[],
  codes: readonly string[],
  select: boolean,
): string[] {
  let next = parseDepartureAirportsParam(selected.join(','));
  for (const code of codes) {
    const canonical = canonicalizeDepartureAirportCode(code);
    if (!canonical) {
      continue;
    }
    const key = canonical.toUpperCase();
    const has = next.some((item) => item.toUpperCase() === key);
    if (select && !has) {
      next = [...next, canonical];
    } else if (!select && has) {
      next = next.filter((item) => item.toUpperCase() !== key);
    }
  }
  return next;
}

export function formatDepartureAirportLabel(code: string): string {
  const canonical = canonicalizeDepartureAirportCode(code);
  if (canonical) {
    const fromRegistry = getCanonicalAirportDisplayName(canonical);
    if (fromRegistry) {
      return fromRegistry;
    }
    return code.trim();
  }

  return code.trim();
}

/** User-facing picker label: city/airport name only, never the IATA code. */
export function formatDepartureAirportOptionLabel(code: string): string {
  return formatDepartureAirportLabel(code);
}

/**
 * Canonical IATA for an offer.
 * `departureAirportCode` is only used when it is actually an IATA/alias, never a country ISO.
 * Provider `airport` text is not an identity unless it is itself an IATA code or proven place name.
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

  return getCanonicalAirportDisplayName(iata);
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

/** Public picker options from the canonical registry (not catalog snapshot). */
export function getPublicDepartureAirportOptions(): DepartureAirportOption[] {
  return listPublicPickerIataCodes().map((code) => ({
    code,
    label: formatDepartureAirportLabel(code),
  }));
}

/** @deprecated Prefer getCanonicalAirportAliasMap — kept for any residual callers. */
export function getDepartureAirportAliasMapForTests(): Readonly<Record<string, string>> {
  return getCanonicalAirportAliasMap();
}
