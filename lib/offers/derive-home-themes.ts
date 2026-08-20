import { TravelOffer } from '../../types/travel';

export type HomeTheme = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
};

type HomeThemeDefinition = {
  id: string;
  title: string;
  description: string;
  href: string;
  matches: (offer: TravelOffer) => boolean;
};

const HOME_THEME_DEFINITIONS: HomeThemeDefinition[] = [
  {
    id: 'all-inclusive',
    title: 'All inclusive',
    description: 'Alles geregeld: maaltijden, drankjes en vaak activiteiten inbegrepen.',
    href: '/results?boardTypes=All%20Inclusive,Ultra%20All%20Inclusive',
    matches: (offer) => Boolean(offer.boardType && /all inclusive/i.test(offer.boardType)),
  },
  {
    id: 'strand',
    title: 'Strand',
    description: 'Zon, zee en strandbestemmingen voor een ontspannen vakantie.',
    href: '/results',
    matches: (offer) => matchesThemeKeywords(offer, ['strand', 'beach', 'zee', 'kust']),
  },
  {
    id: 'familie',
    title: 'Familie',
    description: 'Vakanties die geschikt zijn voor gezinnen met kinderen.',
    href: '/results?vacationTypes=Familie',
    matches: (offer) => matchesThemeKeywords(offer, ['familie', 'family', 'kinder', 'kids']),
  },
  {
    id: 'last-minute',
    title: 'Last minute',
    description: 'Spontaan vertrekken met actuele last-minute aanbiedingen.',
    href: '/results?sort=price',
    matches: (offer) => isLastMinuteOffer(offer),
  },
  {
    id: 'goedkoop',
    title: 'Goedkoop',
    description: 'Vergelijk betaalbare vakanties en vind de beste prijs.',
    href: '/results?sort=price',
    matches: (offer) => offer.price > 0,
  },
  {
    id: 'luxe',
    title: 'Luxe',
    description: 'Premium hotels en extra comfort voor een luxe vakantie.',
    href: '/results?stars=4&sort=stars',
    matches: (offer) => (offer.stars ?? 0) >= 4,
  },
];

function matchesThemeKeywords(offer: TravelOffer, keywords: string[]): boolean {
  const searchableText = [
    offer.categories?.join(' '),
    offer.subcategories,
    offer.descriptionShort,
    offer.descriptionLong,
    offer.hotelName,
    offer.destinationRegion,
    offer.destinationCity,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.some((keyword) => searchableText.includes(keyword));
}

function isLastMinuteOffer(offer: TravelOffer): boolean {
  if (!offer.lastMinute) {
    return false;
  }

  const normalized = String(offer.lastMinute).trim().toLowerCase();

  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}

export function deriveHomeThemes(offers: TravelOffer[]): HomeTheme[] {
  return HOME_THEME_DEFINITIONS.map((theme) => ({
    id: theme.id,
    title: theme.title,
    description: theme.description,
    href: theme.href,
    count: offers.filter(theme.matches).length,
  })).filter((theme) => theme.count > 0);
}
