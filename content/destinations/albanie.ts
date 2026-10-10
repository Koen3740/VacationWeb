import type { DestinationDocument, ResultsLink } from '@/content/destinations/types';
import { MEDIA } from '@/content/destinations/media';

const country: ResultsLink = {
  label: 'Bekijk vakanties in Albanië',
  geo: { country: 'Albanië' },
};

function regionLink(label: string, region: string): ResultsLink {
  return {
    label,
    geo: { country: 'Albanië', region },
    fallback: country,
  };
}

/**
 * Albanië — first destination longread.
 * Place geo ids are the catalog city names. Links appear only when that place
 * is actually in the destination directory (today: country only).
 */
export const albanie: DestinationDocument = {
  slug: 'albanie',
  name: 'Albanië',
  continent: 'Europa',
  country: 'Albanië',
  longread: true,
  chip: { order: 10, label: 'Albanië', isNew: true, geo: { country: 'Albanië' } },
  hero: {
    image: MEDIA.heroDhermi,
    breadcrumb: ['Ontdek', 'Europa', 'Albanië'],
    title: 'Albanië',
    intro:
      'Turquoise baaien, steden van steen en echte bergen, in een land dat Europa lang over het hoofd zag.',
  },
  intro: {
    kicker: 'Reisverhaal · Albanië',
    paragraphs: [
      "Er is een kust in Europa waar je 's ochtends nog alleen bent op een kiezelstrand en waar het water zo helder is dat de bootjes lijken te zweven. Ze ligt niet in Griekenland en ook niet in Kroatië, maar daar ergens tussenin, recht tegenover de hak van Italië.",
      'Albanië was tot begin jaren negentig grotendeels afgesloten van de rest van Europa, en veel reizigers ontdekken het pas nu. Wie gaat, vindt een Ionische Rivièra met witte dorpen, twee stadjes op de UNESCO-werelderfgoedlijst en in het noorden bergen van bijna 2.700 meter. Het voelt soms als de Middellandse Zee van vroeger: eenvoudiger, stiller en vol verrassingen.',
    ],
  },
  video: {
    provider: 'youtube',
    id: 'RaNkjYE-dwM',
    maker: '@olsimeraj',
    makerName: 'Olsi Meraj',
    makerUrl: 'https://www.youtube.com/@olsimeraj',
    title: 'Eerst even kijken?',
    kicker: 'Albanië in één minuut',
    description:
      'Rivieren, watervallen, het kerkje van Theth en de huizen van Berat. Eén minuut Albanië, grotendeels vanuit de lucht.',
    consentCategory: 'marketing',
    watchUrl: 'https://www.youtube.com/shorts/RaNkjYE-dwM',
    autoplay: false,
  },
  chapters: [
    {
      id: 'riviera',
      number: '01',
      kicker: 'De kust',
      navLabel: 'Rivièra',
      title: 'De Rivièra',
      paragraphs: [
        'De weg over de Llogara-pas klimt vanaf de kant van Vlorë door dennenbos omhoog en zakt dan in haarspeldbochten naar de Ionische Zee. Daar begint de Rivièra.',
        'Dhërmi kleeft met zijn witte huizen tegen de helling, Himarë heeft een rustige boulevard, en daartussen liggen kiezelbaaien als Jalë en Gjipe met water waar je de bodem door ziet.',
        "De bergen staan pal achter je handdoek. Wie 's avonds naar een dorp als Vuno rijdt, eet tussen de olijfbomen met de zon die in zee zakt.",
      ],
      image: MEDIA.vunoChapter,
      fact: {
        text: 'De Llogara-pas, de bergweg naar de Rivièra, ligt op 1.027 meter hoogte en daalt aan de zuidkant af naar Dhërmi.',
        source: 'Wikipedia, Llogara Pass (elevation 1,027 m; descends toward Dhërmi)',
        sourceUrl: 'https://en.wikipedia.org/wiki/Llogara_Pass',
      },
      results: regionLink('Vakanties aan de Rivièra', 'Albanese Rivièra'),
    },
    {
      id: 'zuiden',
      number: '02',
      kicker: 'Het zuiden',
      navLabel: 'Het zuiden',
      title: 'Sarandë, Ksamil en Butrint',
      paragraphs: [
        'Hoe zuidelijker je komt, hoe warmer het water. Sarandë is de badplaats met de lange boulevard en Corfu aan de overkant.',
        'Iets verder naar het zuiden ligt Ksamil: witte strandjes en vier rotseilandjes vlak voor de kust, waar je naartoe kunt zwemmen of peddelen.',
        'Tussen twee zwemdagen door wandel je door Butrint, een ruïnestad in het groen aan een lagune. Grieken, Romeinen, Byzantijnen en Venetianen lieten er allemaal iets achter.',
      ],
      image: MEDIA.sarandeChapter,
      fact: {
        text: "Butrint staat sinds 1992 op de UNESCO-werelderfgoedlijst. De oudste sporen van bewoning zijn volgens UNESCO zo'n 50.000 jaar oud.",
        source: 'UNESCO World Heritage List 570, Butrint',
        sourceUrl: 'https://whc.unesco.org/en/list/570',
      },
      results: regionLink('Vakanties in Ksamil en Sarandë', 'Het zuiden'),
    },
    {
      id: 'unesco',
      number: '03',
      kicker: 'Landinwaarts',
      navLabel: 'UNESCO-steden',
      title: 'Twee UNESCO-steden',
      paragraphs: [
        'Landinwaarts verandert het decor van blauw naar steen.',
        'Berat stapelt zijn witte huizen met grote ramen tegen de helling langs de rivier de Osum. Bovenop ligt een burcht waarin nog gewoon mensen wonen, tussen Byzantijnse kerkjes.',
        "Gjirokastër is grijzer en strenger: torenhuizen met daken van steenplaten, een bazaar met ambachtswinkels en een kasteel dat over de vallei waakt. Samen zijn ze goed voor een rondreis van een paar dagen.",
      ],
      image: MEDIA.gjiroChapter,
      fact: {
        text: 'Gjirokastër kwam in 2005 op de UNESCO-werelderfgoedlijst; Berat werd er in 2008 aan toegevoegd. De burcht van Berat gaat terug tot de 4e eeuw voor Christus.',
        source: 'UNESCO World Heritage List 569, Historic Centres of Berat and Gjirokastra',
        sourceUrl: 'https://whc.unesco.org/en/list/569',
      },
      results: regionLink('Rondreizen langs Berat en Gjirokastër', 'Historische steden'),
    },
    {
      id: 'alpen',
      number: '04',
      kicker: 'Het noorden',
      navLabel: 'Alpen',
      title: 'De Albanese Alpen',
      paragraphs: [
        'In het noorden ruilt Albanië de zee in voor kalksteenwanden van meer dan 2.500 meter.',
        'Theth ligt in een groene vallei met een stenen kerkje, watervallen en gastenverblijven bij families thuis.',
        "Overdag wandel je naar de Blauwe Bron of over de pas naar Valbona. 's Avonds komt er op tafel wat de tuin die dag opleverde.",
      ],
      image: MEDIA.thethChapter,
      fact: {
        text: "De Maja e Jezercës (2.694 m) is de hoogste top van de Albanese Alpen. In Theth staat nog een van de laatste 'opsluittorens', waar families zich vroeger verschansten tijdens een bloedvete.",
        source: 'Wikipedia, Maja e Jezercës and Theth',
        sourceUrl: 'https://en.wikipedia.org/wiki/Maja_Jezercë',
      },
      results: regionLink('Vakanties in de Albanese Alpen', 'Albanese Alpen'),
    },
  ],
  places: [
    { name: 'Ksamil', regionLabel: 'Het zuiden', image: MEDIA.ksamil, geo: { country: 'Albanië', city: 'Ksamil' } },
    { name: 'Sarandë', regionLabel: 'Het zuiden', image: MEDIA.sarande, geo: { country: 'Albanië', city: 'Sarandë' } },
    { name: 'Himarë', regionLabel: 'Albanese Rivièra', image: MEDIA.himare, geo: { country: 'Albanië', city: 'Himarë' } },
    { name: 'Dhërmi', regionLabel: 'Albanese Rivièra', image: MEDIA.dhermi, geo: { country: 'Albanië', city: 'Dhërmi' } },
    { name: 'Berat', regionLabel: 'Historische steden', image: MEDIA.berat, geo: { country: 'Albanië', city: 'Berat' } },
    { name: 'Gjirokastër', regionLabel: 'Historische steden', image: MEDIA.gjiro, geo: { country: 'Albanië', city: 'Gjirokastër' } },
    { name: 'Theth', regionLabel: 'Albanese Alpen', image: MEDIA.theth, geo: { country: 'Albanië', city: 'Theth' } },
  ],
  regions: [
    {
      id: 'riviera',
      name: 'Albanese Rivièra',
      summary: 'Tussen de Llogara-pas en Himarë: kiezelbaaien, witte dorpen en bergen tot aan zee.',
      image: MEDIA.dhermi,
      geo: { country: 'Albanië', region: 'Albanese Rivièra' },
      places: [
        { name: 'Dhërmi', geo: { country: 'Albanië', city: 'Dhërmi' } },
        { name: 'Himarë', geo: { country: 'Albanië', city: 'Himarë' } },
        { name: 'Vuno', geo: { country: 'Albanië', city: 'Vuno' } },
      ],
    },
    {
      id: 'zuiden',
      name: 'Het zuiden: Sarandë & Ksamil',
      summary: 'De warmste hoek van het land, met de meeste hotels en de kortste afstand tot Corfu.',
      image: MEDIA.ksamil,
      geo: { country: 'Albanië', region: 'Het zuiden' },
      places: [
        { name: 'Sarandë', geo: { country: 'Albanië', city: 'Sarandë' } },
        { name: 'Ksamil', geo: { country: 'Albanië', city: 'Ksamil' } },
        { name: 'Butrint', geo: { country: 'Albanië', city: 'Butrint' } },
      ],
    },
    {
      id: 'steden',
      name: 'Historische steden',
      summary: 'Twee UNESCO-steden van steen en kalk, ideaal voor een rondreis.',
      image: MEDIA.berat,
      geo: { country: 'Albanië', region: 'Historische steden' },
      places: [
        { name: 'Berat', geo: { country: 'Albanië', city: 'Berat' } },
        { name: 'Gjirokastër', geo: { country: 'Albanië', city: 'Gjirokastër' } },
      ],
    },
    {
      id: 'alpen',
      name: 'Albanese Alpen',
      summary: 'Ruig noorden met bergdorpen, wandelroutes en gastenverblijven.',
      image: MEDIA.theth,
      geo: { country: 'Albanië', region: 'Albanese Alpen' },
      places: [{ name: 'Theth', geo: { country: 'Albanië', city: 'Theth' } }],
    },
  ],
  practical: {
    lead: 'Wanneer je het best gaat, en de praktische zaken op een rij.',
    bestPeriod: {
      title: 'Beste reisperiode',
      note: 'Indicatief, nog te bevestigen met klimaatdata.',
      placeholder: true,
      rows: [
        { label: 'Strand', months: [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 0, 0] },
        { label: 'Rondreis', months: [0, 1, 1, 3, 3, 2, 1, 1, 3, 3, 1, 0] },
      ],
    },
    factsTitle: 'Praktisch',
    facts: [
      { label: 'Vliegtijd vanuit Brussel', value: '± 2u30', placeholder: true },
      { label: 'Luchthavens', value: 'Tirana · Corfu (voor het zuiden)', placeholder: true },
      { label: 'Valuta', value: 'Albanese lek (ALL)', placeholder: true },
      { label: 'Tijdsverschil', value: 'Geen', placeholder: true },
      { label: 'Reisdocument', value: 'Te bevestigen', placeholder: true },
    ],
  },
  finalCta: {
    image: MEDIA.ksamilEnd,
    title: 'Zin gekregen in Albanië?',
    text: 'Wij vergelijken het aanbod van verschillende reisaanbieders. Je boekt rechtstreeks bij de aanbieder.',
    results: country,
  },
  discoveryCards: [
    {
      id: 'albanie-hero',
      order: 10,
      size: 'xl',
      eyebrow: 'Albanië · Albanese Rivièra',
      title: 'Albanië, zoals bijna niemand het kent',
      text: 'Turquoise baaien, witte dorpen en bergen vlak achter de kust.',
      image: MEDIA.dhermi,
      badges: ['new', 'video'],
      themes: [],
      results: country,
      pageLabel: 'Ontdek Albanië',
    },
    {
      id: 'albanie-alpen',
      order: 80,
      size: 'band',
      eyebrow: 'Thema · Bergen & dorpen · Albanië',
      title: 'Wist je dat Albanië Alpen heeft?',
      text: 'Theth: een bergdorp tussen toppen, op een dag rijden van de kust.',
      image: MEDIA.theth,
      badges: ['theme', 'new'],
      themes: ['Bergen & dorpen'],
      results: country,
      pageLabel: 'Lees verder',
      pageHash: 'alpen',
    },
  ],
  stories: [
    {
      id: 'berat',
      order: 10,
      title: 'Berat: de stad van duizend ramen',
      text: "Witte huizen tegen de helling, en 's avonds de hele stad op straat.",
      whenLabel: '2 dagen geleden · Berat, Albanië',
      image: MEDIA.berat2,
      results: {
        label: 'Bekijk vakanties',
        geo: { country: 'Albanië', city: 'Berat' },
        fallback: { label: 'Bekijk vakanties in Albanië', geo: { country: 'Albanië' } },
      },
    },
    {
      id: 'vuno',
      order: 20,
      title: 'Vuno: het bergdorp boven de Rivièra',
      text: 'Steile straatjes, olijfgaarden en zicht op zee.',
      whenLabel: '5 dagen geleden · Vuno, Albanië',
      image: MEDIA.vuno,
      results: {
        label: 'Bekijk vakanties',
        geo: { country: 'Albanië', city: 'Vuno' },
        fallback: { label: 'Bekijk vakanties in Albanië', geo: { country: 'Albanië' } },
      },
    },
    {
      id: 'gjirokaster',
      order: 40,
      title: 'Gjirokastër: bazaar van steen',
      text: 'Ambachtswinkels onder stenen daken, kasteel erboven.',
      whenLabel: '2 weken geleden · Gjirokastër, Albanië',
      image: MEDIA.gjiroBazaar,
      results: {
        label: 'Bekijk vakanties',
        geo: { country: 'Albanië', city: 'Gjirokastër' },
        fallback: { label: 'Bekijk vakanties in Albanië', geo: { country: 'Albanië' } },
      },
    },
  ],
};
