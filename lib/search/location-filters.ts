import type { TravelOffer } from '@/types/travel';
import { offerMatchesAnyKeyword, offerSearchText } from '@/lib/search/offer-text';

/** Qualitative beach location — meter buckets are NOT used (coverage ~4%). */
export const BEACH_LOCATION_VALUES = ['direct', 'walk'] as const;
export type BeachLocation = (typeof BEACH_LOCATION_VALUES)[number];

export const BEACH_LOCATION_LABELS: Record<BeachLocation, string> = {
  direct: 'Direct aan strand',
  walk: 'Op loopafstand',
};

const BEACH_KEYWORDS: Record<BeachLocation, string[]> = {
  direct: [
    'direct aan het strand',
    'direct aan strand',
    'direct aan zee',
    'beachfront',
    'beach front',
    'zo op het strand',
    'vrijwel aan het strand',
  ],
  walk: [
    'strand op loopafstand',
    'op loopafstand van het strand',
    'vlak bij het strand',
    'dicht bij het strand',
    'near the beach',
    'close to the beach',
  ],
};

/** Qualitative center location — meter buckets not usable at scale. */
export const CENTER_LOCATION_VALUES = ['in', 'near'] as const;
export type CenterLocation = (typeof CENTER_LOCATION_VALUES)[number];

export const CENTER_LOCATION_LABELS: Record<CenterLocation, string> = {
  in: 'In het centrum',
  near: 'Nabij / centraal gelegen',
};

const CENTER_KEYWORDS: Record<CenterLocation, string[]> = {
  in: ['in het centrum', 'midden in het centrum'],
  near: [
    'aan de rand van het centrum',
    'op loopafstand van het centrum',
    'centrum op loopafstand',
    'dicht bij het centrum',
    'centraal gelegen',
    'centrale ligging',
    'city centre',
    'city center',
  ],
};

export function offerMatchesBeachLocation(offer: TravelOffer, value: BeachLocation): boolean {
  return offerMatchesAnyKeyword(offerSearchText(offer), BEACH_KEYWORDS[value]);
}

export function offerMatchesCenterLocation(offer: TravelOffer, value: CenterLocation): boolean {
  return offerMatchesAnyKeyword(offerSearchText(offer), CENTER_KEYWORDS[value]);
}

export function offerHasSeaView(offer: TravelOffer): boolean {
  return offerMatchesAnyKeyword(offerSearchText(offer), [
    'zeezicht',
    'sea view',
    'seaview',
    'uitzicht op zee',
    'ocean view',
  ]);
}

export function parseBeachLocationParam(value: string | null | undefined): BeachLocation | undefined {
  if (!value) return undefined;
  const match = BEACH_LOCATION_VALUES.find((item) => item === value.trim().toLowerCase());
  return match;
}

export function parseCenterLocationParam(value: string | null | undefined): CenterLocation | undefined {
  if (!value) return undefined;
  const match = CENTER_LOCATION_VALUES.find((item) => item === value.trim().toLowerCase());
  return match;
}

export function parseSeaViewParam(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'zeezicht';
}
