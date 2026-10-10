/**
 * Destination longread + Discovery magazine content.
 * Add a destination by dropping a new file in this folder and registering it in
 * `content/destinations/index.ts`. Page components do not change.
 */

export type GeoTarget = {
  /** Catalog country, e.g. "Albanië" or "Spanje". */
  country: string;
  /** Catalog area (region or province label), only when we sell that area. */
  region?: string;
  /** Catalog place (city), only when we sell that place. */
  city?: string;
};

export type ResultsLink = {
  label: string;
  geo: GeoTarget;
  /** Used when `geo` is not a destination we actually sell. */
  fallback?: { label: string; geo: GeoTarget };
};

export type MediaAsset = {
  src: string;
  alt: string;
  /** Visible credit, e.g. "Dhërmi · Jani Godari / Unsplash". */
  credit: string;
  photographer: string;
  source: 'unsplash' | 'pexels';
  sourceId: string;
  sourceUrl: string;
  licence: 'Unsplash' | 'Pexels';
  width: number;
  height: number;
  objectPosition: string;
  objectPositionMobile?: string;
};

/** Cookie categories the existing consent store actually has. */
export type ConsentCategory = 'analytics' | 'marketing';

export type DestinationVideo = {
  provider: 'youtube';
  /** YouTube video id (Shorts use the same id). */
  id: string;
  maker: string;
  makerName: string;
  makerUrl: string;
  title: string;
  kicker: string;
  description: string;
  consentCategory: ConsentCategory;
  watchUrl: string;
  /** Must stay false. Autoplay is not allowed. */
  autoplay: false;
};

export type ChapterFact = {
  text: string;
  /** Human-readable source. Not shown as a claim; kept for review. */
  source: string;
  sourceUrl: string;
};

export type DestinationChapter = {
  id: string;
  number: string;
  kicker: string;
  /** Short label in the sticky subnav. */
  navLabel: string;
  title: string;
  paragraphs: string[];
  image: MediaAsset;
  fact: ChapterFact;
  results: ResultsLink;
};

export type StoryPlace = {
  name: string;
  geo: GeoTarget;
  image?: MediaAsset;
};

export type DestinationRegion = {
  id: string;
  name: string;
  summary: string;
  image: MediaAsset;
  geo: GeoTarget;
  places: StoryPlace[];
};

export type SeasonLevel = 0 | 1 | 2 | 3;

export type PracticalRow = {
  label: string;
  value: string;
  /** Unconfirmed practical facts stay marked until the owner verifies them. */
  placeholder: boolean;
};

export type DestinationPractical = {
  lead: string;
  bestPeriod: {
    title: string;
    note: string;
    placeholder: boolean;
    rows: Array<{ label: string; months: SeasonLevel[] }>;
  };
  factsTitle: string;
  facts: PracticalRow[];
};

export type MagazineCardSize = 'xl' | 'tall' | 's' | 'w' | 'band';

export type DiscoveryBadge = 'new' | 'video' | 'theme';

export type DiscoveryCard = {
  id: string;
  order: number;
  size: MagazineCardSize;
  eyebrow: string;
  title: string;
  text: string;
  image: MediaAsset;
  badges: DiscoveryBadge[];
  /** Theme chips this card belongs to (no free-text search). */
  themes: string[];
  results: ResultsLink;
  /** Second link to the longread, when this destination has one. */
  pageLabel?: string;
  pageHash?: string;
};

export type DiscoveryStory = {
  id: string;
  order: number;
  title: string;
  text: string;
  whenLabel: string;
  image: MediaAsset;
  results: ResultsLink;
};

export type DestinationChip = {
  order: number;
  label: string;
  isNew?: boolean;
  geo: GeoTarget;
};

export type DestinationDocument = {
  slug: string;
  name: string;
  /** Continent label in the hero breadcrumb. */
  continent?: string;
  country: string;
  region?: string;
  /** Full longread page. Discovery-only entries leave this false. */
  longread: boolean;
  chip?: DestinationChip;
  hero?: {
    image: MediaAsset;
    breadcrumb: string[];
    title: string;
    intro: string;
  };
  intro?: {
    kicker: string;
    paragraphs: string[];
  };
  video?: DestinationVideo;
  chapters?: DestinationChapter[];
  places?: Array<{
    name: string;
    regionLabel: string;
    image: MediaAsset;
    geo: GeoTarget;
  }>;
  regions?: DestinationRegion[];
  practical?: DestinationPractical;
  finalCta?: {
    image: MediaAsset;
    title: string;
    text: string;
    results: ResultsLink;
  };
  discoveryCards: DiscoveryCard[];
  stories: DiscoveryStory[];
};
