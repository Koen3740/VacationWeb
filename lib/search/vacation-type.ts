import type { TravelOffer } from '@/types/travel';
import { offerMatchesAnyKeyword, offerSearchText } from '@/lib/search/offer-text';

/**
 * Vacation-type filter options backed by feed evidence (WP8C-002/003).
 * Strand/Stad/Natuur removed — not reliable as taxonomy.
 *
 * "Fly & Drive" here is a keyword filter on offerSearchText. It is NOT the
 * proven rondreis SSOT (Corendon Fly & Go can match via subcategory
 * `Fly-Drive vakantie`). See
 * docs/research/provider-landscape/autoproducten-rondreis-classificatie.md
 * and lib/offers/fly-drive-rondreis.ts. Do not change this matcher without an
 * explicit product decision (would alter Results membership).
 */
export const VACATION_TYPE_VALUES = [
  'Adults Only',
  'Familie',
  'Aquapark',
  'Romantisch',
  'Fly & Drive',
] as const;

export type VacationType = (typeof VACATION_TYPE_VALUES)[number];

const KEYWORDS: Record<VacationType, string[]> = {
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
  'Fly & Drive': ['fly-drive', 'fly drive', 'fly & drive', 'fly&drive'],
};

function vacationTypeSearchText(offer: TravelOffer, type: VacationType): string {
  if (type === 'Aquapark') {
    return [offer.categories?.join(' '), offer.subcategories]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return offerSearchText(offer);
}

export function offerMatchesVacationType(offer: TravelOffer, type: VacationType): boolean {
  return offerMatchesAnyKeyword(vacationTypeSearchText(offer, type), KEYWORDS[type]);
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
