import { parseCorendonUrlFragment } from '@/lib/providers/corendon/offer-context';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import { parseVariationRoomNames } from '@/lib/offers/offer-detail-view';
import type { TravelOffer } from '@/types/travel';

export type CatalogSection = {
  title: string;
  items: string[];
};

export type CatalogRoomType = {
  id: string;
  name: string;
  code?: string;
  included: boolean;
  area?: string;
  bedrooms?: string;
  bedConfig?: string;
  airConditioning?: string;
  balcony?: string;
  seaView?: string;
  pool?: string;
  bathroom?: string;
  minibar?: string;
  safe?: string;
  wifi?: string;
  facilities: string[];
  description?: string;
  /** Only filled when a provider field proves a room-specific image. Catalog gallery is not copied here. */
  images: string[];
};

const SECTION_TITLES = [
  'ligging',
  'situation',
  'algemeen & faciliteiten',
  'faciliteiten',
  'facilités',
  'facilites',
  'restaurants & bars',
  'activiteiten & ontspanning',
  'sport & ontspanning',
  'sports & détente',
  'sports & detente',
  'zwembaden',
  'zwembaden & strand',
  'piscine',
  'piscine & plage',
  'kinderfaciliteiten',
  "facilités enfants",
  'facilites enfants',
  'verzorging',
  'pension',
  'hotelkamers',
  "chambres d'hôtel",
  "chambres d'hotel",
  'chambres dhotel',
] as const;

const ROOM_NAME_PREFIX =
  /^(?:\d+-persoonskamer|familiekamer|junior suite|suite\b|studio\b|appartement|voordeelkamer|standaardkamer|superiorkamer|chambres?\b)/i;

const TRAILING_ROOM_CODE = /\s+([A-Z]{1,4}\d{0,2}X?)$/;

const FEATURE_START =
  /^(?:oppervlakte|env\.|ca\.|circa|téléphone|telephone|télévision|television|climatisation|airconditioning|kluis|minibar|wifi|wi-fi|douche|toilette|toilettes|sèche-cheveux|föhn|balcon|balkon|terras|badkamer|eet- en drink|koffie|telefoon|televisie|woon-\/slaapkamer|\d+\s+slaapkamers|chambre\s*\()/i;

function normalizeKey(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim()
    .toLowerCase();
}

function canonicalSectionKey(bullet: string): string | null {
  const cleaned = normalizeKey(bullet.replace(/\(\s*\)$/, ''));
  for (const title of SECTION_TITLES) {
    if (cleaned === title || cleaned.startsWith(`${title}:`) || cleaned.startsWith(`${title} :`)) {
      return title;
    }
  }
  return null;
}

function displaySectionTitle(original: string): string {
  const cleaned = original.replace(/\(\s*\)$/, '').replace(/\s+/g, ' ').trim();
  return (cleaned.split(':')[0] ?? cleaned).trim();
}

const GLUED_SECTION_HEADERS = [
  'Hotelkamers',
  "Chambres d'hôtel",
  "Chambres d'hotel",
  'Ligging',
  'Situation',
  'Faciliteiten',
  'Facilités',
  'Algemeen & faciliteiten',
  'Restaurants & bars',
  'Restaurants & Bars',
  'Activiteiten & ontspanning',
  'Sport & Ontspanning',
  'Sports & Détente',
  'Zwembaden',
  'Zwembaden & Strand',
  'Kinderfaciliteiten',
  'Verzorging',
  'Pension',
];

function separateGluedSectionHeaders(text: string): string {
  let next = text;
  for (const header of GLUED_SECTION_HEADERS) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`(?<![*\\s])(${escaped})\\s*\\*`, 'g'), ' * $1 *');
  }
  return next;
}

function isFeatureBullet(bullet: string): boolean {
  if (/m²/i.test(bullet) || /m2\b/i.test(bullet)) {
    return true;
  }
  return FEATURE_START.test(bullet.trim());
}

function isRoomStart(bullet: string): boolean {
  const trimmed = bullet.trim();
  if (!trimmed) {
    return false;
  }
  const codeMatch = TRAILING_ROOM_CODE.exec(trimmed);
  const namePart = codeMatch ? trimmed.slice(0, codeMatch.index).trim() : trimmed;
  if (codeMatch && ROOM_NAME_PREFIX.test(namePart)) {
    return true;
  }
  return ROOM_NAME_PREFIX.test(trimmed) && !isFeatureBullet(trimmed);
}

function parseRoomName(bullet: string): { name: string; code?: string } {
  const trimmed = bullet.trim();
  const codeMatch = TRAILING_ROOM_CODE.exec(trimmed);
  if (codeMatch && ROOM_NAME_PREFIX.test(trimmed.slice(0, codeMatch.index).trim())) {
    return {
      name: trimmed.slice(0, codeMatch.index).trim(),
      code: codeMatch[1],
    };
  }
  return { name: trimmed };
}

function slugRoomId(name: string, code?: string): string {
  if (code) {
    return code;
  }
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'kamer';
}

function firstMatching(features: string[], pattern: RegExp): string | undefined {
  return features.find((item) => pattern.test(item));
}

function buildRoom(name: string, code: string | undefined, features: string[]): Omit<CatalogRoomType, 'included'> {
  const area = firstMatching(features, /m²|m2\b|oppervlakte/i);
  const bedrooms = firstMatching(features, /slaapkamer/i);
  const bedConfig = firstMatching(features, /bed|slaapbank|eenpersoons|tweepersoons/i);
  const airConditioning = firstMatching(features, /airco|airconditioning|climatisation/i);
  const balcony = firstMatching(features, /balkon|terras|balcon/i);
  const seaView = firstMatching(features, /zeezicht|sea front|vue mer|mer\b/i);
  const pool = firstMatching(features, /zwembad|swim-?up|piscine|pool/i);
  const bathroom = firstMatching(features, /badkamer|douche|bad\b|toilet|salle de bain/i);
  const minibar = firstMatching(features, /minibar/i);
  const safe = firstMatching(features, /kluis|coffre/i);
  const wifi = firstMatching(features, /wifi|wi-fi/i);

  return {
    id: slugRoomId(name, code),
    name,
    code,
    area,
    bedrooms,
    bedConfig,
    airConditioning,
    balcony,
    seaView,
    pool,
    bathroom,
    minibar,
    safe,
    wifi,
    facilities: features,
    description: features.length > 0 ? features.join('. ') : undefined,
    images: [],
  };
}

function parseHotelkamersItems(items: string[]): Array<Omit<CatalogRoomType, 'included'>> {
  const rooms: Array<Omit<CatalogRoomType, 'included'>> = [];
  let current: { name: string; code?: string; features: string[] } | null = null;

  const flush = (): void => {
    if (!current) {
      return;
    }
    rooms.push(buildRoom(current.name, current.code, current.features));
    current = null;
  };

  for (const item of items) {
    const bullet = item.trim();
    if (!bullet) {
      continue;
    }
    if (isRoomStart(bullet)) {
      flush();
      const parsed = parseRoomName(bullet);
      current = { ...parsed, features: [] };
      continue;
    }
    if (current) {
      current.features.push(bullet);
    }
  }
  flush();
  return rooms;
}

export function parseCatalogContent(raw: string | undefined): {
  intro?: string;
  sections: CatalogSection[];
  rooms: Array<Omit<CatalogRoomType, 'included'>>;
} {
  const text = separateGluedSectionHeaders((raw ?? '').replace(/\s+/g, ' ').trim());
  if (!text) {
    return { sections: [], rooms: [] };
  }

  const bullets = text.split(/\s*\*\s*/).map((part) => part.trim()).filter(Boolean);
  const merged = new Map<string, CatalogSection>();
  let intro: string | undefined;
  let currentKey: string | null = null;

  for (const bullet of bullets) {
    const sectionKey = canonicalSectionKey(bullet);
    if (sectionKey) {
      currentKey = sectionKey;
      if (!merged.has(sectionKey)) {
        merged.set(sectionKey, { title: displaySectionTitle(bullet), items: [] });
      }
      continue;
    }
    if (currentKey) {
      merged.get(currentKey)?.items.push(bullet);
      continue;
    }
    if (!intro) {
      intro = bullet;
    }
  }

  const sections = [...merged.values()].filter((section) => section.items.length > 0);
  const hotelkamers =
    merged.get('hotelkamers')
    ?? merged.get("chambres d'hôtel")
    ?? merged.get("chambres d'hotel")
    ?? merged.get('chambres dhotel');
  const rooms = hotelkamers && hotelkamers.items.length > 0 ? parseHotelkamersItems(hotelkamers.items) : [];

  return { intro, sections, rooms };
}

export function fragmentRoomCodeFromDeepLink(deepLink: string | undefined): string | undefined {
  if (!deepLink) {
    return undefined;
  }
  const roomBoard = parseCorendonUrlFragment(deepLink)?.roomBoard;
  const code = roomBoard?.split('-')[0]?.trim();
  return code || undefined;
}

function catalogNameKey(value: string): string {
  return normalizeKey(value.replace(/\([^)]*\)\s*$/, ''));
}

function namesEqual(left: string, right: string): boolean {
  return catalogNameKey(left) === catalogNameKey(right);
}

function markIncluded(
  rooms: Array<Omit<CatalogRoomType, 'included'>>,
  extraInfo: string | undefined,
  fragmentCode: string | undefined,
): CatalogRoomType[] {
  return rooms.map((room) => ({
    ...room,
    included: Boolean(
      (fragmentCode && room.code && room.code.toUpperCase() === fragmentCode.toUpperCase())
      || (extraInfo && namesEqual(room.name, extraInfo)),
    ),
  }));
}

function uniqueRooms(rooms: CatalogRoomType[]): CatalogRoomType[] {
  const seen = new Set<string>();
  const out: CatalogRoomType[] = [];
  for (const room of rooms) {
    const key = `${room.code ?? ''}::${normalizeKey(room.name)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(room);
  }
  return out;
}

/**
 * Room types actually present on this offer: Hotelkamers text, extraInfo, variations.
 * Does not invent types. Does not copy the hotel gallery onto rooms.
 */
export function resolveOfferRoomTypes(offer: TravelOffer): CatalogRoomType[] {
  const sourceText = offer.descriptionLong || offer.feedDescription;
  const parsed = parseCatalogContent(sourceText);
  const extraInfo = offer.extraInfo?.trim();
  const fragmentCode =
    offer.provider === CORENDON_PROVIDER_NAME
      ? fragmentRoomCodeFromDeepLink(offer.deepLink)
      : undefined;

  let rooms = markIncluded(parsed.rooms, extraInfo, fragmentCode);

  if (rooms.length === 0 && extraInfo) {
    rooms = [
      {
        ...buildRoom(extraInfo, fragmentCode, []),
        included: true,
      },
    ];
  }

  const variationNames = parseVariationRoomNames(offer.variations);
  for (const name of variationNames) {
    if (rooms.some((room) => namesEqual(room.name, name))) {
      continue;
    }
    rooms.push({
      ...buildRoom(name, undefined, []),
      included: Boolean(extraInfo && namesEqual(name, extraInfo)),
    });
  }

  const unique = uniqueRooms(rooms);
  if (unique.length === 1 && extraInfo && namesEqual(unique[0].name, extraInfo)) {
    return unique.map((room) => ({ ...room, included: true }));
  }
  return unique;
}

export function selectCatalogRoom(
  rooms: CatalogRoomType[],
  selectedRoomId: string | undefined,
): CatalogRoomType | null {
  if (rooms.length === 0) {
    return null;
  }
  if (selectedRoomId) {
    const match = rooms.find((room) => room.id.toLowerCase() === selectedRoomId.toLowerCase());
    if (match) {
      return match;
    }
  }
  return rooms.find((room) => room.included) ?? rooms[0];
}

/**
 * lowestpricesacco is proven for the listing fragment (feed room), not for
 * arbitrary catalog Hotelkamers codes. Alternate rooms stay fail-closed.
 */
export function selectedRoomAllowsProvenLivePrice(selected: CatalogRoomType | null): boolean {
  if (!selected) {
    return true;
  }
  return selected.included;
}

export function catalogSectionsForDisplay(
  raw: string | undefined,
): { intro?: string; sections: CatalogSection[] } {
  const parsed = parseCatalogContent(raw);
  return {
    intro: parsed.intro,
    sections: parsed.sections.filter((section) => {
      const key = normalizeKey(section.title);
      return !key.startsWith('hotelkamers') && !key.startsWith('chambres d');
    }),
  };
}
