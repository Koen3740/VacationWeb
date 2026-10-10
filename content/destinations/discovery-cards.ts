import type { DestinationDocument, DiscoveryCard, GeoTarget } from '@/content/destinations/types';
import { MEDIA } from '@/content/destinations/media';

function geoCard(
  doc: Omit<DestinationDocument, 'discoveryCards' | 'stories' | 'longread'> & { longread?: boolean },
  card: DiscoveryCard,
): DestinationDocument {
  return {
    longread: false,
    stories: [],
    ...doc,
    discoveryCards: [card],
  };
}

function chip(order: number, label: string, geo: GeoTarget, isNew?: boolean) {
  return { order, label, geo, isNew };
}

/** Supported destinations that appear on Discovery before they have a longread. */
export const DISCOVERY_CARD_DESTINATIONS: readonly DestinationDocument[] = [
  geoCard(
    {
      slug: 'sardinie',
      name: 'Sardinië',
      country: 'Italië',
      region: 'Sardinië',
      chip: chip(80, 'Sardinië', { country: 'Italië', region: 'Sardinië' }),
    },
    {
      id: 'verborgen-stranden',
      order: 20,
      size: 'tall',
      eyebrow: 'Thema · Sardinië en meer',
      title: 'Verborgen stranden',
      text: 'Baaitjes die je pas ziet als je er bent.',
      image: MEDIA.sardiniaCove,
      badges: ['theme'],
      themes: ['Verborgen stranden'],
      results: {
        label: 'Bekijk vakanties op Sardinië',
        geo: { country: 'Italië', region: 'Sardinië' },
      },
    },
  ),
  {
    slug: 'andalusie',
    name: 'Andalusië',
    country: 'Spanje',
    region: 'Andalusië',
    longread: false,
    chip: chip(20, 'Andalusië', { country: 'Spanje', region: 'Andalusië' }),
    discoveryCards: [
      {
        id: 'rondreizen',
        order: 30,
        size: 's',
        eyebrow: 'Thema · Andalusië',
        title: 'Rondreizen',
        text: 'Elke dag een nieuwe plek, met je eigen auto.',
        image: MEDIA.ronda,
        badges: ['theme'],
        themes: ['Rondreizen'],
        results: {
          label: 'Bekijk vakanties in Andalusië',
          geo: { country: 'Spanje', region: 'Andalusië' },
        },
      },
    ],
    stories: [
      {
        id: 'frigiliana',
        order: 30,
        title: 'Frigiliana voor de dagjesmensen komen',
        text: 'Witte trappen en bloempotten in het ochtendlicht.',
        whenLabel: '1 week geleden · Frigiliana, Andalusië',
        image: MEDIA.frigiliana,
        results: {
          label: 'Bekijk vakanties in Frigiliana',
          geo: { country: 'Spanje', city: 'Frigiliana' },
        },
      },
    ],
  },
  geoCard(
    {
      slug: 'sicilie',
      name: 'Sicilië',
      country: 'Italië',
      region: 'Sicilië',
      chip: chip(90, 'Sicilië', { country: 'Italië', region: 'Sicilië' }),
    },
    {
      id: 'sicilie',
      order: 40,
      size: 's',
      eyebrow: 'Italië',
      title: 'Sicilië',
      text: 'Cefalù: strand, dom en rots in één blik.',
      image: MEDIA.cefalu,
      badges: [],
      themes: ['Steden'],
      results: {
        label: 'Bekijk vakanties op Sicilië',
        geo: { country: 'Italië', region: 'Sicilië' },
      },
    },
  ),
  geoCard(
    {
      slug: 'madeira',
      name: 'Madeira',
      country: 'Portugal',
      region: 'Madeira',
      chip: chip(60, 'Madeira', { country: 'Portugal', region: 'Madeira' }, true),
    },
    {
      id: 'madeira',
      order: 50,
      size: 's',
      eyebrow: 'Portugal',
      title: 'Madeira',
      text: "Groene kliffen, levada's en eeuwige lente.",
      image: MEDIA.madeira,
      badges: ['new'],
      themes: [],
      results: {
        label: 'Bekijk vakanties op Madeira',
        geo: { country: 'Portugal', region: 'Madeira' },
      },
    },
  ),
  geoCard(
    {
      slug: 'kreta',
      name: 'Kreta',
      country: 'Griekenland',
      region: 'Kreta',
      chip: chip(50, 'Kreta', { country: 'Griekenland', region: 'Kreta' }),
    },
    {
      id: 'kreta',
      order: 60,
      size: 'w',
      eyebrow: 'Griekenland',
      title: 'Kreta',
      text: "De Venetiaanse haven van Chania, 's avonds op z'n mooist.",
      image: MEDIA.chania,
      badges: [],
      themes: ['Steden'],
      results: {
        label: 'Bekijk vakanties op Kreta',
        geo: { country: 'Griekenland', region: 'Kreta' },
      },
    },
  ),
  geoCard(
    {
      slug: 'algarve',
      name: 'Algarve',
      country: 'Portugal',
      region: 'Algarve',
      chip: chip(30, 'Algarve', { country: 'Portugal', region: 'Algarve' }),
    },
    {
      id: 'algarve',
      order: 70,
      size: 'w',
      eyebrow: 'Portugal',
      title: 'Algarve',
      text: 'Wandelpaden langs de kliffen naar eindeloze stranden.',
      image: MEDIA.algarve,
      badges: [],
      themes: [],
      results: {
        label: 'Bekijk vakanties in de Algarve',
        geo: { country: 'Portugal', region: 'Algarve' },
      },
    },
  ),
  {
    slug: 'mallorca',
    name: 'Mallorca',
    country: 'Spanje',
    region: 'Mallorca',
    longread: false,
    chip: chip(70, 'Mallorca', { country: 'Spanje', region: 'Mallorca' }),
    discoveryCards: [],
    stories: [],
  },
  {
    slug: 'canarische-eilanden',
    name: 'Canarische Eilanden',
    country: 'Spanje',
    region: 'Canarische Eilanden',
    longread: false,
    chip: chip(40, 'Canarische Eilanden', { country: 'Spanje', region: 'Canarische Eilanden' }),
    discoveryCards: [],
    stories: [],
  },
  {
    slug: 'turkije',
    name: 'Turkije',
    country: 'Turkije',
    longread: false,
    chip: chip(100, 'Turkije', { country: 'Turkije' }),
    discoveryCards: [],
    stories: [],
  },
];
