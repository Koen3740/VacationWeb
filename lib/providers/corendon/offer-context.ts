import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { ProviderListing } from '../../feeds/types/stored-offer';
import type { SearchParams } from '../../../types/travel';
import {
  CORENDON_ALLOWED_FE_HOSTS,
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_HOST_BE_FR,
  CORENDON_FE_HOST_NL,
  CORENDON_PROVIDER_NAME,
  CORENDON_TWO_ROOM_2A_PARTY,
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

export type CorendonUpsalesPax = {
  birthDate: string;
  roomNr: 1 | 2;
};

export type CorendonLiveContext = {
  accommodationId: string;
  fragment: CorendonUrlFragment;
  departureIso: string;
  /** originalHost / browserHost from the listing productURL. */
  feHost: CorendonFeHost;
  listing?: ProviderListing;
  partyComposition?: readonly (readonly string[])[];
  /** Default `lowest`. `upsales` = 4 travellers / 2 rooms using SearchParams.party DOBs. */
  pricingRoute?: 'lowest' | 'upsales';
  upsalesPax?: readonly CorendonUpsalesPax[];
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

export type CorendonLiveOccupancy =
  | { ok: true; roomCount: 1 | 2; pricingRoute: 'lowest' }
  | { ok: true; roomCount: 2; pricingRoute: 'upsales'; pax: CorendonUpsalesPax[] };

const ISO_DOB = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDob(value: string | null | undefined): value is string {
  return typeof value === 'string' && ISO_DOB.test(value);
}

/**
 * Proven live occupancy:
 * - 2 travellers / 1 room → lowestpricesacco CORENDON_DEFAULT_2A_PARTY
 * - 2 travellers / 2 rooms → lowestpricesacco CORENDON_TWO_ROOM_2A_PARTY (Bijbel §10.3)
 * - 4 travellers / 2 rooms with party ISO DOBs → lowestpricesacco hop + upsales pax
 *   (Bijbel §8.4 occupancy-price on upsales; §10.3 pax[].roomNr multi-room)
 *
 * Real ISO DOBs are never rewritten into lowestpricesacco partyComposition tokens.
 * Missing party DOBs are not filled with placeholders.
 */
export function resolveCorendonLiveOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): CorendonLiveOccupancy | { ok: false; reason: 'invalid_occupancy' } {
  const party = params.party;
  if (party && party.length > 0) {
    if (party.length === 4) {
      if (!party.every((traveller) => isIsoDob(traveller.dateOfBirth))) {
        return { ok: false, reason: 'invalid_occupancy' };
      }
      const roomCounts = [0, 0];
      for (const traveller of party) {
        if (traveller.roomIndex !== 0 && traveller.roomIndex !== 1) {
          return { ok: false, reason: 'invalid_occupancy' };
        }
        roomCounts[traveller.roomIndex] += 1;
      }
      if (roomCounts[0] < 1 || roomCounts[1] < 1) {
        return { ok: false, reason: 'invalid_occupancy' };
      }
      return {
        ok: true,
        roomCount: 2,
        pricingRoute: 'upsales',
        pax: party.map((traveller) => ({
          birthDate: traveller.dateOfBirth as string,
          roomNr: (traveller.roomIndex + 1) as 1 | 2,
        })),
      };
    }
    if (party.length !== 2) {
      return { ok: false, reason: 'invalid_occupancy' };
    }
    const distinctRooms = new Set(party.map((traveller) => traveller.roomIndex));
    if (distinctRooms.size === 1) {
      return { ok: true, roomCount: 1, pricingRoute: 'lowest' };
    }
    if (distinctRooms.size === 2) {
      return { ok: true, roomCount: 2, pricingRoute: 'lowest' };
    }
    return { ok: false, reason: 'invalid_occupancy' };
  }

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

  if (adults !== 2 || children !== 0 || babies !== 0) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  if (rooms === 1) {
    return { ok: true, roomCount: 1, pricingRoute: 'lowest' };
  }
  if (rooms === 2) {
    return { ok: true, roomCount: 2, pricingRoute: 'lowest' };
  }

  return { ok: false, reason: 'invalid_occupancy' };
}

export function buildCorendonLiveContext(
  offer: TravelOffer,
  params: SearchParams,
  listing?: ProviderListing | null,
): CorendonLiveContext | null {
  if (!isCorendon(offer)) {
    return null;
  }
  const occupancy = resolveCorendonLiveOccupancy(params);
  if (!occupancy.ok) {
    return null;
  }

  const selected = listing ?? listingFromOfferDeepLink(offer);
  if (!selected?.deepLink) {
    return null;
  }

  const accommodationId = extractCorendonAccommodationId(offer.id);
  const fragment = parseCorendonUrlFragment(selected.deepLink);
  const feHost = resolveCorendonFeHost(selected.deepLink);
  if (!accommodationId || !fragment || !feHost) {
    return null;
  }
  if (fragment.hotelId !== accommodationId) {
    return null;
  }
  if (selected.host && selected.host.toLowerCase() !== feHost) {
    return null;
  }

  const departureIso = corendonFragmentDateToIso(fragment.dateYymmdd);
  if (!departureIso) {
    return null;
  }

  return {
    accommodationId,
    fragment,
    departureIso,
    feHost,
    listing: {
      ...selected,
      host: feHost,
    },
    partyComposition: occupancy.roomCount === 2 ? CORENDON_TWO_ROOM_2A_PARTY : CORENDON_DEFAULT_2A_PARTY,
    pricingRoute: occupancy.pricingRoute,
    ...(occupancy.pricingRoute === 'upsales' ? { upsalesPax: occupancy.pax } : {}),
  };
}

function listingFromOfferDeepLink(offer: TravelOffer): ProviderListing | null {
  if (!offer.deepLink) {
    return null;
  }
  const host = offer.listingHost ?? resolveCorendonFeHost(offer.deepLink);
  if (!host) {
    return null;
  }
  return {
    provider: CORENDON_PROVIDER_NAME,
    feedId:
      offer.feedSourceId ??
      (host === CORENDON_FE_HOST_NL
        ? 'corendon-nl'
        : host === CORENDON_FE_HOST_BE_FR
          ? 'corendon-befr'
          : 'corendon-benl'),
    campaignId: offer.affiliateCampaignId,
    host,
    deepLink: offer.deepLink,
  };
}
