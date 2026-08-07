export type ResultsIntroVariant = 'country' | 'region' | 'multi' | 'all';

export type ResultsIntroContent = {
  heroTitle: string;
  heroSubtitle: string;
  resultsTitle: string;
  resultsSummary: string;
  badges?: string[];
};

/** Layout-only intro content — later wired to dynamic CMS/search context */
export const RESULTS_INTRO_BY_VARIANT: Record<ResultsIntroVariant, ResultsIntroContent> = {
  country: {
    heroTitle: '188 vakanties in Spanje',
    heroSubtitle: 'Gouden stranden, bruisende steden en de lekkerste keuken.',
    resultsTitle: '188 vakanties gevonden',
    resultsSummary: 'Spanje • 1 aug – 31 aug • 8 - 11 dagen • 2 volwassenen • 1 kamer',
  },
  region: {
    heroTitle: '64 vakanties in Costa Blanca',
    heroSubtitle: 'Zonnige stranden, knusse baaien en levendige kustplaatsen.',
    resultsTitle: '64 vakanties gevonden',
    resultsSummary: 'Costa Blanca • 1 aug – 31 aug • 8 - 11 dagen • 2 volwassenen • 1 kamer',
  },
  multi: {
    heroTitle: '312 vakanties',
    heroSubtitle:
      'Vergelijk vakanties van meerdere bestemmingen en ontdek waar jouw budget het meeste vakantie oplevert.',
    resultsTitle: '312 vakanties gevonden',
    resultsSummary: 'Spanje, Griekenland, Turkije • 1 aug – 31 aug • 8 - 11 dagen • 2 volwassenen',
    badges: ['Spanje', 'Griekenland', 'Turkije'],
  },
  all: {
    heroTitle: 'Vergelijk duizenden vakanties',
    heroSubtitle:
      'Vergelijk duizenden vakanties van meerdere reispartners en ontdek waar jouw budget het meeste vakantie oplevert.',
    resultsTitle: 'Duizenden vakanties gevonden',
    resultsSummary: 'Alle bestemmingen • Flexibele periode • 2 volwassenen',
  },
};
