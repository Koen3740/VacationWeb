import type {
  DestinationChapter,
  DestinationDocument,
  DiscoveryBadge,
  DiscoveryCard,
  DiscoveryStory,
  MediaAsset,
} from '@/content/destinations/types';
import { DISCOVERY_UPDATED_LABEL } from '@/content/destinations/index';
import { resolveGeoHref, resolveResultsLink } from '@/lib/discovery/supported-geo';

export type ResolvedLink = { href: string; label: string };

export type MagazineCard = {
  id: string;
  size: DiscoveryCard['size'];
  eyebrow: string;
  title: string;
  text: string;
  image: MediaAsset;
  badges: DiscoveryBadge[];
  themes: string[];
  results: ResolvedLink;
  pageHref?: string;
  pageLabel?: string;
};

export type MagazineStory = {
  id: string;
  title: string;
  text: string;
  whenLabel: string;
  image: MediaAsset;
  results: ResolvedLink;
};

export type MagazineChip = {
  label: string;
  isNew: boolean;
  href: string;
};

export type MagazineModel = {
  title: string;
  lead: string;
  updatedLabel: string;
  cards: MagazineCard[];
  stories: MagazineStory[];
  chips: MagazineChip[];
  themes: string[];
};

export type PlaceStripItem = {
  name: string;
  regionLabel: string;
  image: MediaAsset;
  results: ResolvedLink | null;
};

export type RegionView = {
  id: string;
  name: string;
  summary: string;
  image: MediaAsset;
  places: Array<{ name: string; results: ResolvedLink | null }>;
  results: ResolvedLink | null;
};

export type DestinationView = {
  slug: string;
  name: string;
  countryHref: ResolvedLink;
  hero: NonNullable<DestinationDocument['hero']>;
  intro: NonNullable<DestinationDocument['intro']>;
  video: DestinationDocument['video'];
  chapters: Array<Omit<DestinationChapter, 'results'> & { results: ResolvedLink }>;
  places: PlaceStripItem[];
  regions: RegionView[];
  practical: DestinationDocument['practical'];
  finalCta: Omit<NonNullable<DestinationDocument['finalCta']>, 'results'> & { results: ResolvedLink };
  other: MagazineChip[];
};

export function destinationPath(slug: string, hash?: string): string {
  const path = `/ontdek/${encodeURIComponent(slug)}`;
  return hash ? `${path}#${hash}` : path;
}

function cardView(doc: DestinationDocument, card: DiscoveryCard): MagazineCard | null {
  const results = resolveResultsLink(card.results);
  if (!results) return null;
  return {
    id: card.id,
    size: card.size,
    eyebrow: card.eyebrow,
    title: card.title,
    text: card.text,
    image: card.image,
    badges: card.badges,
    themes: card.themes,
    results,
    pageHref: doc.longread ? destinationPath(doc.slug, card.pageHash) : undefined,
    pageLabel: doc.longread ? card.pageLabel : undefined,
  };
}

function storyView(story: DiscoveryStory): MagazineStory | null {
  const results = resolveResultsLink(story.results);
  if (!results) return null;
  return {
    id: story.id,
    title: story.title,
    text: story.text,
    whenLabel: story.whenLabel,
    image: story.image,
    results,
  };
}

const THEME_ORDER = ['Verborgen stranden', 'Rondreizen', 'Steden', 'Bergen & dorpen'];

export function buildMagazine(docs: readonly DestinationDocument[]): MagazineModel {
  const cards = docs
    .flatMap((doc) => doc.discoveryCards.map((card) => ({ card, doc })))
    .sort((left, right) => left.card.order - right.card.order)
    .map(({ doc, card }) => cardView(doc, card))
    .filter((card): card is MagazineCard => Boolean(card));

  const stories = docs
    .flatMap((doc) => doc.stories)
    .sort((left, right) => left.order - right.order)
    .map(storyView)
    .filter((story): story is MagazineStory => Boolean(story));

  const chips = docs
    .flatMap((doc) => (doc.chip ? [doc.chip] : []))
    .sort((left, right) => left.order - right.order)
    .map((chip) => {
      const href = resolveGeoHref(chip.geo);
      if (!href) return null;
      return { label: chip.label, isNew: Boolean(chip.isNew), href };
    })
    .filter((chip): chip is MagazineChip => Boolean(chip));

  const present = new Set(cards.flatMap((card) => card.themes));
  const themes = THEME_ORDER.filter((theme) => present.has(theme));
  const freshCount = chips.filter((chip) => chip.isNew).length;
  const freshLabel =
    freshCount === 1 ? '1 nieuwe bestemming' : `${freshCount} nieuwe bestemmingen`;

  return {
    title: 'Ontdek',
    lead: 'Plekken waarvan je niet wist dat ze zo mooi zijn. Elke week nieuw.',
    updatedLabel: `Bijgewerkt ${DISCOVERY_UPDATED_LABEL} · ${freshLabel}`,
    cards,
    stories,
    chips,
    themes,
  };
}

export function buildDestinationView(
  doc: DestinationDocument,
  docs: readonly DestinationDocument[],
): DestinationView | null {
  if (!doc.longread || !doc.hero || !doc.intro || !doc.chapters || !doc.finalCta) return null;
  const countryHref = resolveGeoHref({ country: doc.country, region: doc.region });
  if (!countryHref) return null;
  const countryLink: ResolvedLink = { href: countryHref, label: `Bekijk vakanties in ${doc.name}` };

  const chapters = doc.chapters.map((chapter) => {
    const results = resolveResultsLink(chapter.results);
    if (!results) {
      throw new Error(`Chapter ${doc.slug}/${chapter.id} has no supported results link`);
    }
    return { ...chapter, results };
  });

  const places: PlaceStripItem[] = (doc.places ?? []).map((place) => {
    const specific = resolveGeoHref(place.geo);
    return {
      name: place.name,
      regionLabel: place.regionLabel,
      image: place.image,
      results: specific
        ? { href: specific, label: `Bekijk vakanties in ${place.name}` }
        : countryLink,
    };
  });

  const regions: RegionView[] = (doc.regions ?? []).map((region) => {
    const regionHref = resolveGeoHref(region.geo);
    return {
      id: region.id,
      name: region.name,
      summary: region.summary,
      image: region.image,
      places: region.places.map((place) => {
        const href = resolveGeoHref(place.geo);
        return {
          name: place.name,
          results: href ? { href, label: `Bekijk vakanties in ${place.name}` } : null,
        };
      }),
      results: regionHref
        ? { href: regionHref, label: 'Bekijk vakanties in deze regio' }
        : countryLink,
    };
  });

  const finalResults = resolveResultsLink(doc.finalCta.results);
  if (!finalResults) return null;

  const magazine = buildMagazine(docs);

  return {
    slug: doc.slug,
    name: doc.name,
    countryHref: countryLink,
    hero: doc.hero,
    intro: doc.intro,
    video: doc.video,
    chapters,
    places,
    regions,
    practical: doc.practical,
    finalCta: { ...doc.finalCta, results: finalResults },
    other: magazine.chips.filter((chip) => chip.label !== doc.name),
  };
}

export function collectResultsHrefs(docs: readonly DestinationDocument[]): string[] {
  const hrefs = new Set<string>();
  const magazine = buildMagazine(docs);
  for (const card of magazine.cards) hrefs.add(card.results.href);
  for (const story of magazine.stories) hrefs.add(story.results.href);
  for (const chip of magazine.chips) hrefs.add(chip.href);
  for (const doc of docs) {
    const view = buildDestinationView(doc, docs);
    if (!view) continue;
    hrefs.add(view.countryHref.href);
    for (const chapter of view.chapters) hrefs.add(chapter.results.href);
    for (const place of view.places) {
      if (place.results) hrefs.add(place.results.href);
    }
    for (const region of view.regions) {
      if (region.results) hrefs.add(region.results.href);
      for (const place of region.places) {
        if (place.results) hrefs.add(place.results.href);
      }
    }
    hrefs.add(view.finalCta.results.href);
  }
  return [...hrefs];
}
