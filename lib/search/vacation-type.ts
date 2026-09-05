import type { TravelOffer } from '@/types/travel';
import { isRoadtripOffer } from '@/lib/offers/fly-drive-rondreis';
import { offerMatchesAnyKeyword, offerSearchText } from '@/lib/search/offer-text';

/**
 * Vacation-type filter options.
 * Strand/Stad/Natuur removed — not reliable as taxonomy.
 *
 * Internal URL value for Roadtrip remains `Fly & Drive` (backward compatible).
 * UI label: "Roadtrip (Fly & Drive)" — see VACATION_TYPE_LABELS.
 *
 * Matching for Fly & Drive is provider-proven Roadtrip classification
 * (`isRoadtripOffer`), NOT a broad offerSearchText keyword scan.
 * Corendon subcategory `Fly-Drive vakantie` alone is NOT Roadtrip
 * (covers Fly & Go / ordinary car packages).
 *
 * SSOT: docs/research/provider-landscape/autoproducten-rondreis-classificatie.md
 */
export const VACATION_TYPE_VALUES = [
  'Adults Only',
  'Familie',
  'Aquapark',
  'Romantisch',
  'Fly & Drive',
] as const;

export type VacationType = (typeof VACATION_TYPE_VALUES)[number];

type InterestVacationType = Exclude<VacationType, 'Fly & Drive'>;

/** URL/internal value for the Roadtrip filter. */
export const ROADTRIP_VACATION_TYPE: VacationType = 'Fly & Drive';

export const ROADTRIP_FILTER_LABEL = 'Roadtrip (Fly & Drive)';

export const VACATION_TYPE_LABELS: Record<VacationType, string> = {
  'Adults Only': 'Adults Only',
  Familie: 'Familie',
  Aquapark: 'Aquapark',
  Romantisch: 'Romantisch',
  'Fly & Drive': ROADTRIP_FILTER_LABEL,
};

/** Vacation types shown as ordinary interest checkboxes (Roadtrip rendered separately). */
export const INTEREST_VACATION_TYPE_VALUES: VacationType[] = VACATION_TYPE_VALUES.filter(
  (type) => type !== ROADTRIP_VACATION_TYPE,
);

const KEYWORDS: Record<InterestVacationType, string[]> = {
  'Adults Only': ['adults only', 'adults-only', 'adult only', 'alleen volwassenen'],
  Familie: [
    'ideaal voor families',
    'kindvriendelijk',
    'familiehotel',
    'family hotel',
    'family-friendly',
    'family friendly',
    'kinderclub',
    'kids club',
    'kidsclub',
  ],
  // Structured taxonomy / USP tags only — not free description or photo captions.
  Aquapark: ['aquapark', 'aqua park', 'waterpark', 'water park'],
  Romantisch: ['romantisch', 'ideaal voor stellen'],
};

function vacationTypeSearchText(offer: TravelOffer, type: InterestVacationType): string {
  if (type === 'Aquapark') {
    return [offer.categories?.join(' '), offer.subcategories]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return offerSearchText(offer);
}

export function offerMatchesVacationType(offer: TravelOffer, type: VacationType): boolean {
  if (type === ROADTRIP_VACATION_TYPE) {
    return isRoadtripOffer(offer);
  }
  const interestType = type as InterestVacationType;
  return offerMatchesAnyKeyword(vacationTypeSearchText(offer, interestType), KEYWORDS[interestType]);
}

export function offerMatchesAnyVacationType(
  offer: TravelOffer,
  types: VacationType[],
): boolean {
  if (types.length === 0) {
    return true;
  }
  return types.some((type) => offerMatchesVacationType(offer, type));
}

export function parseVacationTypesParam(value: string | null | undefined): VacationType[] {
  if (!value) {
    return [];
  }

  const selected = new Set<VacationType>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    const match = VACATION_TYPE_VALUES.find(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      selected.add(match);
    }
  }

  return VACATION_TYPE_VALUES.filter((type) => selected.has(type));
}

export function serializeVacationTypesParam(types: VacationType[] | undefined): string | undefined {
  if (!types?.length) {
    return undefined;
  }
  const normalized = parseVacationTypesParam(types.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}
