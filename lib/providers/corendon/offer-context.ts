import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import {
  CORENDON_ALLOWED_FE_HOSTS,
  CORENDON_PROVIDER_NAME,
  type CorendonFeHost,
} from './constants';

export type CorendonUrlFragment = {
  raw: string;
  hotelId: string;
  accommodationCode: string;
  airportRoute: string;
  dateYymmdd: string;
  durationNights: string;
  roomBoard: string;
};

export type CorendonLiveContext = {
  accommodationId: string;
  fragment: CorendonUrlFragment;
  departureIso: string;
  /** originalHost / browserHost from the unwrapped productURL. */
  feHost: CorendonFeHost;
};

export function isCorendon(offer: Pick<TravelOffer, 'provider'>): boolean {
  return offer.provider === CORENDON_PROVIDER_NAME;
}

/** Feed externalId: corendon-{accommodationId} */
export function extractCorendonAccommodationId(offerId: string): string | null {
  const match = /^corendon-(\d+)(?:-|$)/i.exec(offerId.trim());
  return match?.[1] ?? null;
}

export function unwrapCorendonProductUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const nested = url.searchParams.get('u') || url.searchParams.get('r');
    if (nested) {
      return decodeURIComponent(nested);
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Only hosts already present on proven BE / available NL productURLs. */
export function resolveCorendonFeHost(productUrl: string): CorendonFeHost | null {
  try {
    const host = new URL(unwrapCorendonProductUrl(productUrl)).hostname.toLowerCase();
    return (CORENDON_ALLOWED_FE_HOSTS as readonly string[]).includes(host)
      ? (host as CorendonFeHost)
      : null;
  } catch {
    return null;
  }
}

export function parseCorendonUrlFragment(productUrl: string): CorendonUrlFragment | null {
  try {
    const url = new URL(unwrapCorendonProductUrl(productUrl));
    const raw = (url.hash || '').replace(/^#/, '');
    if (!raw) {
      return null;
    }
    const parts = raw.split('.');
    const hotelId = parts[0] || '';
    const accommodationCode = parts[1] || '';
    const airportRoute = parts[2] || '';
    const dateYymmdd = parts[3] || '';
    const durationNights = parts[4] || '';
    const roomBoard = parts[5] || '';
    if (!hotelId || !accommodationCode || !airportRoute || dateYymmdd.length !== 6) {
      return null;
    }
    return {
      raw,
      hotelId,
      accommodationCode,
      airportRoute,
      dateYymmdd,
      durationNights,
      roomBoard,
    };
  } catch {
    return null;
  }
}

/** Fragment date is DDMMYY (coverage audit). */
export function corendonFragmentDateToIso(dateYymmdd: string): string | null {
  if (!dateYymmdd || dateYymmdd.length !== 6) {
    return null;
  }
  const dd = dateYymmdd.slice(0, 2);
  const mm = dateYymmdd.slice(2, 4);
  const yy = dateYymmdd.slice(4, 6);
  const yyyy = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Default 2A / 0C / 0B / 1 room only — same occupancy gate as Package 1.
 * Non-default pax would require invented child ages (not allowed).
 */
export function resolveCorendonLiveOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms'>,
): { ok: true } | { ok: false; reason: 'invalid_occupancy' } {
  const adults = params.adults ?? 2;
  const children = params.children ?? 0;
  const babies = params.babies ?? 0;
  const rooms = params.rooms ?? 1;

  if (
    !Number.isFinite(adults) ||
    !Number.isFinite(children) ||
    !Number.isFinite(babies) ||
    !Number.isFinite(rooms)
  ) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  if (adults !== 2 || children !== 0 || babies !== 0 || rooms !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  return { ok: true };
}

export function buildCorendonLiveContext(
  offer: TravelOffer,
  params: SearchParams,
): CorendonLiveContext | null {
  if (!isCorendon(offer)) {
    return null;
  }
  if (!resolveCorendonLiveOccupancy(params).ok) {
    return null;
  }

  const accommodationId = extractCorendonAccommodationId(offer.id);
  const fragment = offer.deepLink ? parseCorendonUrlFragment(offer.deepLink) : null;
  const feHost = offer.deepLink ? resolveCorendonFeHost(offer.deepLink) : null;
  if (!accommodationId || !fragment || !feHost) {
    return null;
  }
  if (fragment.hotelId !== accommodationId) {
    return null;
  }

  const departureIso = corendonFragmentDateToIso(fragment.dateYymmdd);
  if (!departureIso) {
    return null;
  }

  return { accommodationId, fragment, departureIso, feHost };
}
