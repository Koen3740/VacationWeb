"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_LABEL_BY_KEY = exports.COUNTRY_CANONICAL_KEY = void 0;
exports.normalizeDestinationKey = normalizeDestinationKey;
exports.resolveCountryKey = resolveCountryKey;
exports.isExcludedCountryKey = isExcludedCountryKey;
exports.isExcludedCountry = isExcludedCountry;
exports.registerLabelVariant = registerLabelVariant;
exports.pickCanonicalLabel = pickCanonicalLabel;
exports.resolveCanonicalCountry = resolveCanonicalCountry;
exports.resolveCanonicalPlaceName = resolveCanonicalPlaceName;
const EXCLUDED_COUNTRY_KEYS = new Set(['belgie', 'nederland', 'luxemburg']);
/** Maps alternate normalized keys to one canonical country key. */
exports.COUNTRY_CANONICAL_KEY = {
    engeland: 'verenigdkoninkrijk',
    grootbrittannie: 'verenigdkoninkrijk',
    kaapverdie: 'kaapverdischeeilanden',
};
/** Canonical display labels keyed by canonical country key. */
exports.COUNTRY_LABEL_BY_KEY = {
    albanie: 'Albanië',
    brazilie: 'Brazilië',
    curacao: 'Curaçao',
    ijsland: 'IJsland',
    indonesie: 'Indonesië',
    italie: 'Italië',
    kroatie: 'Kroatië',
    slovenie: 'Slovenië',
    tsjechie: 'Tsjechië',
    tunesie: 'Tunesië',
    verenigdkoninkrijk: 'Verenigd Koninkrijk',
    kaapverdischeeilanden: 'Kaapverdische Eilanden',
    dominicaanserepubliek: 'Dominicaanse Republiek',
    verenigdarabischeemiraten: 'Verenigde Arabische Emiraten',
    verenigdestaten: 'Verenigde Staten',
    canarischeeilanden: 'Canarische Eilanden',
    zuidafrika: 'Zuid-Afrika',
    zuidkorea: 'Zuid-Korea',
    costarica: 'Costa Rica',
    puertorico: 'Puerto Rico',
    srilanka: 'Sri Lanka',
    nieuwzeeland: 'Nieuw-Zeeland',
    saudiarabie: 'Saudi-Arabië',
};
function normalizeDestinationKey(value) {
    if (!value) {
        return '';
    }
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}
function resolveCountryKey(countryKey) {
    return exports.COUNTRY_CANONICAL_KEY[countryKey] ?? countryKey;
}
function isExcludedCountryKey(countryKey) {
    return EXCLUDED_COUNTRY_KEYS.has(countryKey);
}
function isExcludedCountry(country) {
    return isExcludedCountryKey(normalizeDestinationKey(country));
}
function registerLabelVariant(variants, label, labelByKey = exports.COUNTRY_LABEL_BY_KEY) {
    if (!label?.trim()) {
        return;
    }
    const trimmed = label.trim();
    const key = normalizeDestinationKey(trimmed);
    const existing = variants.get(key);
    if (!existing) {
        variants.set(key, { label: trimmed, count: 1 });
        return;
    }
    existing.count += 1;
    const preferred = labelByKey[key];
    if (preferred) {
        existing.label = preferred;
        return;
    }
    if (normalizeDestinationKey(existing.label) === key && existing.label !== trimmed) {
        const existingHasDiacritics = existing.label.normalize('NFD') !==
            existing.label.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const trimmedHasDiacritics = trimmed.normalize('NFD') !==
            trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        if (trimmedHasDiacritics && !existingHasDiacritics) {
            existing.label = trimmed;
        }
    }
}
function pickCanonicalLabel(variants, labelByKey = exports.COUNTRY_LABEL_BY_KEY) {
    if (variants.size === 0) {
        return undefined;
    }
    const ranked = [...variants.values()].sort((left, right) => {
        if (right.count !== left.count) {
            return right.count - left.count;
        }
        return left.label.localeCompare(right.label, 'nl');
    });
    const preferredKey = normalizeDestinationKey(ranked[0].label);
    return labelByKey[preferredKey] ?? ranked[0].label;
}
function resolveCanonicalCountry(country, countryVariants) {
    if (!country?.trim()) {
        return undefined;
    }
    const key = resolveCountryKey(normalizeDestinationKey(country));
    if (isExcludedCountryKey(key)) {
        return undefined;
    }
    if (exports.COUNTRY_LABEL_BY_KEY[key]) {
        return exports.COUNTRY_LABEL_BY_KEY[key];
    }
    return countryVariants?.get(key)?.label ?? country.trim();
}
function resolveCanonicalPlaceName(label, variants) {
    if (!label?.trim()) {
        return undefined;
    }
    const key = normalizeDestinationKey(label);
    return variants.get(key)?.label ?? label.trim();
}
