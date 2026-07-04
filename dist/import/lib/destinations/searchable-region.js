"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSearchableRegion = resolveSearchableRegion;
exports.registerSearchableRegionVariant = registerSearchableRegionVariant;
exports.resolveCanonicalSearchableRegion = resolveCanonicalSearchableRegion;
const normalize_key_1 = require("./normalize-key");
const REGION_LABEL_BY_KEY = {
    turkseriviera: 'Turkse Rivièra',
    egeischekust: 'Egeische Kust',
    atlantischekust: 'Atlantische Kust',
    rodezee: 'Rode Zee',
    costadelsol: 'Costa del Sol',
    costablanca: 'Costa Blanca',
    costabrava: 'Costa Brava',
    costadorada: 'Costa Dorada',
    costadealmeria: 'Costa de Almería',
    costadelazahar: 'Costa del Azahar',
    costadelaluz: 'Costa de la Luz',
};
const EXCLUDED_REGION_KEYS = new Set([
    'barcelona',
    'madrid',
    'sevilla',
    'valencia',
    'malaga',
    'alicante',
    'cordoba',
    'granada',
    'murcia',
    'rome',
    'milaan',
    'venetie',
    'florence',
    'napels',
    'turijn',
    'bologna',
    'verona',
    'londen',
    'manchester',
    'edinburgh',
    'parijs',
    'nice',
    'lyon',
    'marseille',
    'berlijn',
    'munchen',
    'hamburg',
    'frankfurt',
    'keulen',
    'dusseldorf',
    'amsterdam',
    'rotterdam',
    'praag',
    'praagenomstreken',
    'boedapest',
    'wenen',
    'zurich',
    'geneve',
    'brussel',
    'antwerpen',
    'lissabon',
    'porto',
    'athene',
    'thessaloniki',
    'istanbul',
    'ankara',
    'dubai',
    'abudhabi',
    'newyork',
    'lasvegas',
    'losangeles',
    'miami',
    'sanfrancisco',
    'washington',
    'chicago',
    'boston',
    'marrakech',
    'casablanca',
    'tirana',
    'durres',
    'saranda',
    'vlore',
    'golem',
    'radhime',
    'baskenland',
    'catalonie',
    'andalusie',
    'balearen',
    'canarischeeilanden',
    'golfvancadiz',
    'albanie',
    'albaneseriviera',
]);
const RESORT_REGION_KEYS = new Set([
    'algarve',
    'madeira',
    'azoren',
    'kreta',
    'rhodos',
    'kos',
    'corfu',
    'zakynthos',
    'santorini',
    'mykonos',
    'naxos',
    'paros',
    'lesbos',
    'chalkidiki',
    'peloponnesos',
    'mallorca',
    'ibiza',
    'menorca',
    'formentera',
    'tenerife',
    'grancanaria',
    'fuerteventura',
    'lanzarote',
    'lapalma',
    'lagomera',
    'elhierro',
    'bali',
    'lombok',
    'yucatan',
    'cancun',
    'rivieramaya',
    'playadelcarmen',
    'oostkust',
    'puntacana',
    'santodomingo',
    'bavaro',
    'bodrum',
    'marmaris',
    'antalya',
    'side',
    'kemer',
    'alanya',
    'kusadasi',
    'didim',
    'fethiye',
    'dalaman',
    'cyprus',
    'paphos',
    'larnaca',
    'limassol',
    'ayianapa',
    'sardinia',
    'sicilie',
    'puglia',
    'calabrie',
    'toscane',
    'gardameer',
    'adriatischekust',
    'zuiditaliaansekust',
    'cotedazur',
    'provence',
    'corsica',
    'normandie',
    'bretagne',
    'ardennen',
    'vogezen',
    'dolomieten',
    'zillertal',
    'tirol',
    'salzburgerland',
    'steiermark',
    'kaarnten',
    'dalmatie',
    'istrie',
    'kvarner',
    'split',
    'dubrovnik',
    'zadar',
    'phuket',
    'krabi',
    'kohsamui',
    'pattaya',
    'hurghada',
    'sharmelsheikh',
    'marsaalam',
    'agadir',
    'essaouira',
    'seychellen',
    'mauritius',
    'zanzibar',
    'kaapverdie',
    'sal',
    'boavista',
    'aruba',
    'curacao',
    'bonaire',
    'jamaica',
    'barbados',
    'dominicaanserepubliek',
    'srilanka',
    'maldiven',
    'goa',
    'kerala',
    'rajasthan',
    'montegobay',
    'negril',
    'ochorios',
    'runawaybay',
    'sunnybeach',
    'goldensands',
    'norddalmatie',
    'middendalmatie',
    'zuiddalmatie',
    'istrieenkvarner',
    'plovdiv',
    'varna',
    'burgas',
    'sunshinecoast',
    'goldcoast',
    'whitsundays',
    'queensland',
    'fiji',
    'tahiti',
    'borabora',
    'moorea',
    'zuidkorea',
    'jeju',
    'jordanie',
    'aqaba',
    'dodecanese',
    'cycladen',
    'ionischeeilanden',
    'sporaden',
    'evia',
    'thassos',
    'samothraki',
    'skiathos',
    'skopelos',
    'lefkada',
    'kefalonia',
    'parga',
    'halkidiki',
    'pieria',
    'chalkidiki',
    'sithonia',
    'kassandra',
    'mountathos',
    'mountolympus',
    'lesvos',
    'limnos',
    'chios',
    'samos',
    'patmos',
    'kalymnos',
    'symi',
    'tilos',
    'nisyros',
    'astypalaia',
    'karpathos',
    'kasos',
    'kastellorizo',
    'leros',
    'lipsi',
    'megisti',
    'ushuaia',
]);
function isInvalidPlaceName(value) {
    if (!value?.trim()) {
        return true;
    }
    const trimmed = value.trim();
    return trimmed === '.' || trimmed.length < 2;
}
function normalizePollutedRegionLabel(label) {
    const lower = label.toLowerCase();
    if (lower.includes('turkse riviera') || lower.includes('turkse rivièra')) {
        return 'Turkse Rivièra';
    }
    if (lower.includes('lycische kust')) {
        return 'Lycische Kust';
    }
    if (lower.includes('olympische riviera')) {
        return 'Olympische Riviera';
    }
    return label.trim();
}
function pickCanonicalRegionLabel(label) {
    const cleaned = normalizePollutedRegionLabel(label);
    const key = (0, normalize_key_1.normalizeDestinationKey)(cleaned);
    return REGION_LABEL_BY_KEY[key] ?? cleaned;
}
function isIncludedResortRegion(key) {
    if (RESORT_REGION_KEYS.has(key)) {
        return true;
    }
    if (key.startsWith('costa')) {
        return true;
    }
    if (key.includes('riviera') || key.includes('riviera') || key.includes('rivièra')) {
        return true;
    }
    if (key.endsWith('kust') || key.includes('kust')) {
        return true;
    }
    if (key.includes('eiland') || key.includes('island')) {
        return true;
    }
    if (key.includes('zee') && !key.includes('zeeuw')) {
        return true;
    }
    return false;
}
function resolveCandidateLabel(label) {
    if (isInvalidPlaceName(label)) {
        return undefined;
    }
    const key = (0, normalize_key_1.normalizeDestinationKey)(label);
    if (EXCLUDED_REGION_KEYS.has(key)) {
        return undefined;
    }
    if (!isIncludedResortRegion(key)) {
        return undefined;
    }
    return pickCanonicalRegionLabel(label);
}
function resolveSearchableRegion(input) {
    const countryKey = (0, normalize_key_1.normalizeDestinationKey)(input.country);
    if (!countryKey) {
        return undefined;
    }
    const provinceLabel = resolveCandidateLabel(input.province);
    if (provinceLabel) {
        return provinceLabel;
    }
    const regionLabel = resolveCandidateLabel(input.region);
    if (!regionLabel) {
        return undefined;
    }
    if ((0, normalize_key_1.normalizeDestinationKey)(regionLabel) === countryKey) {
        return undefined;
    }
    if (input.city &&
        (0, normalize_key_1.normalizeDestinationKey)(input.city) === (0, normalize_key_1.normalizeDestinationKey)(regionLabel)) {
        return undefined;
    }
    return regionLabel;
}
function registerSearchableRegionVariant(variants, label) {
    const key = (0, normalize_key_1.normalizeDestinationKey)(label);
    const canonical = pickCanonicalRegionLabel(label);
    const existing = variants.get(key);
    if (!existing) {
        variants.set(key, { label: canonical, count: 1 });
        return;
    }
    existing.count += 1;
    const preferred = REGION_LABEL_BY_KEY[key];
    if (preferred) {
        existing.label = preferred;
        return;
    }
    const existingHasDiacritics = existing.label.normalize('NFD') !==
        existing.label.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const canonicalHasDiacritics = canonical.normalize('NFD') !==
        canonical.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (canonicalHasDiacritics && !existingHasDiacritics) {
        existing.label = canonical;
    }
}
function resolveCanonicalSearchableRegion(label, variants) {
    const key = (0, normalize_key_1.normalizeDestinationKey)(label);
    return variants.get(key)?.label ?? pickCanonicalRegionLabel(label);
}
