import type { SiteNavKey } from '@/lib/site/site-nav';
import type { UiLanguage } from '@/lib/i18n/ui-language';

/**
 * One dictionary for the translated site chrome (t66u): language popup, headers, navigation,
 * mobile drawer, homepage sections, homepage search-field labels and footer.
 *
 * NL = the existing Dutch copy, unchanged. FR = Belgian French for vacationweb.be.
 * Not in this dictionary (stays Dutch): Results, offer detail, funnel, provider/offer data,
 * search popups and value formatters, Discover card data, /bestemmingen, /aanbiedingen,
 * /favorieten, legal pages (/privacy, /cookies, /cookie-settings), cookie banner, geo attribution.
 */
export type ChromeCopy = {
  meta: { title: string; description: string; ogDescription: string };
  languageDialog: { title: string };
  switcher: { label: string; change: string };
  nav: Record<SiteNavKey, string> & { ariaLabel: string };
  header: { saved: string; favorites: string; account: string };
  mobileNav: { title: string; open: string; close: string };
  hero: { eyebrow: string; title: string; subtitle: string; scrollHint: string };
  search: {
    destinationLabel: string;
    destinationPlaceholder: string;
    destinationHintEmpty: string;
    oneDestination: string;
    oneCountry: string;
    countries: (count: number) => string;
    whenLabel: string;
    whenDefault: string;
    whenHint: string;
    durationLabel: string;
    durationPlaceholder: string;
    durationHint: string;
    airportLabel: string;
    airportHint: string;
    travelersLabel: string;
    cta: string;
    busy: string;
  };
  trust: {
    ariaLabel: string;
    kicker: string;
    title: string;
    items: ReadonlyArray<{ label: string; detail: string }>;
  };
  discover: { kicker: string; title: string; subtitle: string; viewAll: string; offers: string };
  inspiration: { eyebrow: string; title: string; body: string; cta: string; quote: string };
  popular: {
    title: string;
    subtitle: string;
    viewAll: string;
    fallbackBlurb: string;
    /** Display names only; links keep the catalog (Dutch) country key. */
    countryNames: Readonly<Record<string, string>>;
    blurbs: Readonly<Record<string, string>>;
  };
  value: {
    kicker: string;
    title: string;
    body: string;
    cta: string;
    points: ReadonlyArray<{ title: string; body: string }>;
  };
  newsletter: {
    title: string;
    body: string;
    unavailable: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
  };
  footer: {
    discoverHeading: string;
    aboutHeading: string;
    serviceHeading: string;
    about: string;
    mission: string;
    howItWorks: string;
    faq: string;
    contact: string;
    blog: string;
    travelInfo: string;
    privacy: string;
    cookies: string;
    cookieSettings: string;
    cookiePreferences: string;
    socialAriaLabel: string;
    tagline: string;
    backToTop: string;
  };
  legal: { subnavAriaLabel: string; dutchOnlyNotice: string | null };
};

const NL: ChromeCopy = {
  meta: {
    title: 'VacationWeb | Meer vakantie voor jouw budget',
    description:
      'Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht. Boek rechtstreeks bij de reisorganisatie.',
    ogDescription: 'Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht.',
  },
  languageDialog: { title: 'Kies je taal / Choisissez votre langue' },
  switcher: { label: 'Taal', change: 'Taal wijzigen' },
  nav: {
    ariaLabel: 'Hoofdnavigatie',
    discover: 'Discover',
    destinations: 'Bestemmingen',
    inspiration: 'Inspiratie',
    offers: 'Aanbiedingen',
    about: 'Over ons',
  },
  header: { saved: 'Opgeslagen', favorites: 'Favorieten', account: 'Account' },
  mobileNav: { title: 'Menu', open: 'Menu openen', close: 'Menu sluiten' },
  hero: {
    eyebrow: 'Vakanties vergelijken bij meerdere reisaanbieders',
    title: 'Meer vakantie voor jouw budget.',
    subtitle:
      'Zoek één keer, vergelijk aanbiedingen van verschillende reispartners en kies zelf waar je boekt.',
    scrollHint: 'Scroll',
  },
  search: {
    destinationLabel: 'Bestemming',
    destinationPlaceholder: 'Waar wil je naartoe?',
    destinationHintEmpty: 'Kies een of meer bestemmingen',
    oneDestination: '1 bestemming',
    oneCountry: '1 land',
    countries: (count) => `${count} landen`,
    whenLabel: 'Wanneer',
    whenDefault: 'Data flexibel',
    whenHint: 'Datum of periode',
    durationLabel: 'Reisduur',
    durationPlaceholder: 'Aantal dagen',
    durationHint: 'Flexibel',
    airportLabel: 'Vertrekluchthaven',
    airportHint: 'Flexibel',
    travelersLabel: 'Reizigers',
    cta: 'Vakanties vergelijken',
    busy: 'Zoeken…',
  },
  trust: {
    ariaLabel: 'Vertrouwen',
    kicker: 'Waarom VacationWeb',
    title: 'Eén zoekopdracht. Jij houdt het overzicht.',
    items: [
      { label: 'Onafhankelijk', detail: 'Eerlijke vergelijking' },
      { label: 'Actuele prijs', detail: 'Direct van de aanbieder' },
      { label: 'Boek rechtstreeks', detail: 'Bij de reisorganisatie' },
      { label: 'Betrouwbaar & transparant', detail: 'Jij kiest, wij vergelijken' },
    ],
  },
  discover: {
    kicker: 'Bestemmingen ontdekken',
    title: 'Waar zou je nu willen zijn?',
    subtitle: '',
    viewAll: 'Alle bestemmingen',
    offers: 'Aanbiedingen',
  },
  inspiration: {
    eyebrow: 'Meer dan vakanties',
    title: 'Reizen verrijkt je leven',
    body: 'Nieuwe plekken. Andere culturen. Bijzondere mensen. Of je nu ver weg gaat of dichter bij huis blijft — reizen opent je wereld.',
    cta: 'Laat je inspireren',
    quote: '“Niet alleen een bestemming, maar een ander perspectief.”',
  },
  popular: {
    title: 'Populaire bestemmingen',
    subtitle: 'Tijdloze favorieten, altijd een goed idee.',
    viewAll: 'Bekijk alle bestemmingen',
    fallbackBlurb: 'Ontdek & vergelijk',
    countryNames: {},
    blurbs: {
      Griekenland: 'Zon, zee en eindeloze charme',
      Spanje: 'Van eilanden tot cultuursteden',
      Turkije: 'Oosterse gastvrijheid',
      'Italië': 'Dolce vita, altijd dichtbij',
      Portugal: 'Trams, heuvels en azulejos',
    },
  },
  value: {
    kicker: 'Zo werkt het',
    title: 'In drie stappen naar je vakantie',
    body: 'VacationWeb vergelijkt. Boeken en betalen doe je bij de reispartner die jij kiest.',
    cta: 'Start met zoeken',
    points: [
      {
        title: 'Zoeken',
        body: 'Kies bestemming, periode, reisduur, luchthaven en reizigers.',
      },
      {
        title: 'Vergelijken',
        body: 'Bekijk aanbiedingen van verschillende reispartners naast elkaar.',
      },
      {
        title: 'Boeken bij de aanbieder',
        body: 'Je gaat door naar de reispartner en boekt daar rechtstreeks.',
      },
    ],
  },
  newsletter: {
    title: 'Blijf ontdekken',
    body: 'Nieuwsbriefinschrijving is nog niet beschikbaar. Laat hier later je e-mail achter wanneer we discovery-updates aanbieden.',
    unavailable: 'Nog niet beschikbaar — er is niets opgeslagen of verzonden.',
    emailLabel: 'E-mailadres',
    emailPlaceholder: 'Jouw e-mailadres',
    submit: 'Inschrijven',
  },
  footer: {
    discoverHeading: 'Ontdek',
    aboutHeading: 'Over ons',
    serviceHeading: 'Service',
    about: 'Onafhankelijk vakanties vergelijken. Je boekt rechtstreeks bij de reispartner.',
    mission: 'Onze missie',
    howItWorks: 'Zo werkt het',
    faq: 'Veelgestelde vragen',
    contact: 'Contact',
    blog: 'Blog',
    travelInfo: 'Reisinformatie',
    privacy: 'Privacybeleid',
    cookies: 'Cookiebeleid',
    cookieSettings: 'Cookie-instellingen',
    cookiePreferences: 'Cookievoorkeuren',
    socialAriaLabel: 'Sociale media',
    tagline: 'Reis verder.',
    backToTop: 'Terug naar boven',
  },
  legal: { subnavAriaLabel: 'Privacy navigatie', dutchOnlyNotice: null },
};

const FR: ChromeCopy = {
  meta: {
    title: 'VacationWeb | Plus de vacances pour votre budget',
    description:
      'Comparez les vacances de plusieurs voyagistes en une seule recherche. Réservez directement auprès du voyagiste.',
    ogDescription: 'Comparez les vacances de plusieurs voyagistes en une seule recherche.',
  },
  languageDialog: { title: 'Kies je taal / Choisissez votre langue' },
  switcher: { label: 'Langue', change: 'Changer de langue' },
  nav: {
    ariaLabel: 'Navigation principale',
    discover: 'Découvrir',
    destinations: 'Destinations',
    inspiration: 'Inspiration',
    offers: 'Promotions',
    about: 'À propos',
  },
  header: { saved: 'Favoris', favorites: 'Favoris', account: 'Compte' },
  mobileNav: { title: 'Menu', open: 'Ouvrir le menu', close: 'Fermer le menu' },
  hero: {
    eyebrow: 'Comparez des vacances chez plusieurs voyagistes',
    title: 'Plus de vacances pour votre budget.',
    subtitle:
      'Cherchez une fois, comparez les offres de différents partenaires et choisissez vous-même où réserver.',
    scrollHint: 'Défiler',
  },
  search: {
    destinationLabel: 'Destination',
    destinationPlaceholder: 'Où souhaitez-vous partir\u00a0?',
    destinationHintEmpty: 'Choisissez une ou plusieurs destinations',
    oneDestination: '1 destination',
    oneCountry: '1 pays',
    countries: (count) => `${count} pays`,
    whenLabel: 'Quand',
    whenDefault: 'Dates flexibles',
    whenHint: 'Date ou période',
    durationLabel: 'Durée du séjour',
    durationPlaceholder: 'Nombre de jours',
    durationHint: 'Flexible',
    airportLabel: 'Aéroport de départ',
    airportHint: 'Flexible',
    travelersLabel: 'Voyageurs',
    cta: 'Comparer les vacances',
    busy: 'Recherche en cours…',
  },
  trust: {
    ariaLabel: 'Confiance',
    kicker: 'Pourquoi VacationWeb',
    title: 'Une recherche. Vous gardez la vue d’ensemble.',
    items: [
      { label: 'Indépendant', detail: 'Une comparaison honnête' },
      { label: 'Prix actuel', detail: 'Directement du voyagiste' },
      { label: 'Réservez en direct', detail: 'Auprès du voyagiste' },
      { label: 'Fiable et transparent', detail: 'Vous choisissez, nous comparons' },
    ],
  },
  discover: {
    kicker: 'Découvrir des destinations',
    title: 'Où aimeriez-vous être\u00a0?',
    subtitle: '',
    viewAll: 'Toutes les destinations',
    offers: 'Promotions',
  },
  inspiration: {
    eyebrow: 'Bien plus que des vacances',
    title: 'Voyager enrichit la vie',
    body: 'De nouveaux lieux. D’autres cultures. Des rencontres uniques. Que vous partiez loin ou restiez plus près de chez vous, voyager ouvre votre horizon.',
    cta: 'Laissez-vous inspirer',
    quote: '«\u00a0Pas seulement une destination, mais un autre regard.\u00a0»',
  },
  popular: {
    title: 'Destinations populaires',
    subtitle: 'Des valeurs sûres, toujours une bonne idée.',
    viewAll: 'Voir toutes les destinations',
    fallbackBlurb: 'Découvrir et comparer',
    countryNames: {
      Griekenland: 'Grèce',
      Spanje: 'Espagne',
      Turkije: 'Turquie',
      'Italië': 'Italie',
      Portugal: 'Portugal',
    },
    blurbs: {
      Griekenland: 'Soleil, mer et charme infini',
      Spanje: 'Des îles aux villes d’art',
      Turkije: 'L’hospitalité orientale',
      'Italië': 'La dolce vita, toujours à portée',
      Portugal: 'Trams, collines et azulejos',
    },
  },
  value: {
    kicker: 'Comment ça marche',
    title: 'Vos vacances en trois étapes',
    body: 'VacationWeb compare. Vous réservez et payez auprès du partenaire que vous choisissez.',
    cta: 'Lancer la recherche',
    points: [
      {
        title: 'Chercher',
        body: 'Choisissez la destination, la période, la durée, l’aéroport et les voyageurs.',
      },
      {
        title: 'Comparer',
        body: 'Voyez les offres de différents partenaires côte à côte.',
      },
      {
        title: 'Réserver chez le voyagiste',
        body: 'Vous continuez chez le partenaire et réservez directement là-bas.',
      },
    ],
  },
  newsletter: {
    title: 'Continuez à découvrir',
    body: 'L’inscription à la newsletter n’est pas encore disponible. Vous pourrez bientôt laisser votre adresse e-mail ici pour recevoir nos nouvelles découvertes.',
    unavailable: 'Pas encore disponible\u00a0: rien n’a été enregistré ni envoyé.',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'Votre adresse e-mail',
    submit: 'S’inscrire',
  },
  footer: {
    discoverHeading: 'Découvrir',
    aboutHeading: 'À propos',
    serviceHeading: 'Service',
    about:
      'Comparez des vacances en toute indépendance. Vous réservez directement auprès du partenaire de voyage.',
    mission: 'Notre mission',
    howItWorks: 'Comment ça marche',
    faq: 'Questions fréquentes',
    contact: 'Contact',
    blog: 'Blog',
    travelInfo: 'Infos voyage',
    privacy: 'Politique de confidentialité',
    cookies: 'Politique en matière de cookies',
    cookieSettings: 'Paramètres des cookies',
    cookiePreferences: 'Préférences en matière de cookies',
    socialAriaLabel: 'Réseaux sociaux',
    tagline: 'Voyagez plus loin.',
    backToTop: 'Retour en haut',
  },
  legal: {
    subnavAriaLabel: 'Navigation confidentialité',
    dutchOnlyNotice: 'Cette page est actuellement disponible uniquement en néerlandais.',
  },
};

export const CHROME_COPY: Readonly<Record<UiLanguage, ChromeCopy>> = { nl: NL, fr: FR };

export function chromeCopy(language: UiLanguage): ChromeCopy {
  return CHROME_COPY[language] ?? NL;
}
