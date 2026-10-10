import type { DestinationDocument } from '@/content/destinations/types';
import { DESTINATIONS } from '@/content/destinations';
import { destinationPath } from '@/lib/discovery/model';
import { resolveResultsLink } from '@/lib/discovery/supported-geo';

/** Discovery magazine. */
export const HOMEPAGE_DISCOVERY_HREF = '/ontdek' as const;

/** Offers index. VacationWeb does not sell the trips on that page. */
export const HOMEPAGE_OFFERS_HREF = '/aanbiedingen' as const;

export type HomepageDestinationTile = {
  id: string;
  title: string;
  place: string;
  href: string;
  kind: 'longread' | 'results';
  imageSrc: string;
  imageAlt: string;
  /** Visible-credit string already stored on the verified Discovery asset. */
  credit: string;
  objectPosition: string;
};

/**
 * Six homepage tiles, in lab order: one longread (Albanië) and five
 * supported results URLs. A missing destination or an unsupported geo
 * target throws — the homepage must not link to a place we do not sell.
 */
const TILE_ORDER: ReadonlyArray<{ slug: string; cardId: string; longread?: boolean }> = [
  { slug: 'albanie', cardId: 'albanie-hero', longread: true },
  { slug: 'kreta', cardId: 'kreta' },
  { slug: 'sicilie', cardId: 'sicilie' },
  { slug: 'algarve', cardId: 'algarve' },
  { slug: 'sardinie', cardId: 'verborgen-stranden' },
  { slug: 'madeira', cardId: 'madeira' },
];

export function homepageDestinationTiles(
  docs: readonly DestinationDocument[] = DESTINATIONS,
): HomepageDestinationTile[] {
  return TILE_ORDER.map((spec) => {
    const doc = docs.find((item) => item.slug === spec.slug);
    if (!doc) {
      throw new Error(`Homepage tile destination missing: ${spec.slug}`);
    }
    const card = doc.discoveryCards.find((item) => item.id === spec.cardId);
    if (!card) {
      throw new Error(`Homepage tile card missing: ${spec.cardId}`);
    }
    const results = resolveResultsLink(card.results);
    if (!results) {
      throw new Error(`Homepage tile has no supported results URL: ${spec.cardId}`);
    }
    const longread = Boolean(spec.longread && doc.longread);
    const place = card.image.credit.split('·')[0]?.trim() || doc.name;
    return {
      id: card.id,
      title: doc.name,
      place,
      href: longread ? destinationPath(doc.slug) : results.href,
      kind: longread ? 'longread' : 'results',
      imageSrc: card.image.src,
      imageAlt: card.image.alt,
      credit: card.image.credit,
      objectPosition: card.image.objectPosition,
    };
  });
}
