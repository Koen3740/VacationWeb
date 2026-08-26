import type { TravelOffer } from '@/types/travel';
import { canonicalizeBoardType } from '@/lib/offers/canonicalize-board-type';

const DUTCH_LOCALES = ['nl-NL', 'nl-BE'] as const;

const FRENCH_COPY_MARKERS =
  /l['’]hôtel|situé|est un |à seulement|ses clients|sous le soleil|anciennement|bénéficient|magnifique hôtel|chambre\b|personnes|classe enfant|petit déjeuner|tout compris|se trouvent|à côté|vous pouvez|depuis la|les merveilleux|ensoleillée|au bord de la|la promenade|télévision|climatisation/i;

/**
 * Deterministic Corendon BE-FR → NL phrase map (no external translator).
 * Keeps BE-FR enrichment visible in NL UI as Dutch copy.
 */
const FRENCH_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/chambre\s+et\s+petit\s+d[ée]jeuner/gi, 'Logies & ontbijt'],
  [/petit\s+d[ée]jeuner/gi, 'ontbijt'],
  [/chambre\s+2\s+personnes/gi, '2-persoonskamer'],
  [/chambre\s+double\s+standard/gi, '2-persoonskamer Standaard'],
  [/chambre\s+double/gi, '2-persoonskamer'],
  [/chambre\s+deluxe/gi, 'Deluxe kamer'],
  [/chambre\s+standard/gi, 'Standaardkamer'],
  [/chambres\s+standard/gi, 'Standaardkamers'],
  [/classe\s+enfant\s*(\d+)/gi, 'Kinderklasse $1'],
  [/classe\s+enfant/gi, 'Kinderklasse'],
  [/\bextra\s+bed\b/gi, 'extra bed'],
  [/\benf\.\b/gi, 'kind'],
  [/\bad\.\b/gi, 'volw.'],
];

export function preferredDutchLocalizedText(
  localized: Record<string, string> | undefined,
): string | undefined {
  if (!localized) {
    return undefined;
  }
  for (const locale of DUTCH_LOCALES) {
    const text = localized[locale]?.trim();
    if (text) {
      return text;
    }
  }
  return undefined;
}

export function hasDutchProviderListing(offer: TravelOffer): boolean {
  const listings = offer.providerListings ?? [];
  if (listings.some((listing) => listing.locale?.toLowerCase().startsWith('nl'))) {
    return true;
  }
  const host = (offer.listingHost ?? '').toLowerCase();
  if (host === 'www.corendon.be' || host === 'www.corendon.nl') {
    return true;
  }
  const feed = offer.feedSourceId ?? '';
  return feed === 'corendon-benl' || feed === 'corendon-nl' || feed === 'corendon-primary';
}

export function isLikelyFrenchCopy(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return FRENCH_COPY_MARKERS.test(trimmed);
}

/** Map known BE-FR catalog phrases to Dutch; leave unknown French unmarked. */
export function translateFrenchCatalogPhraseToDutch(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isLikelyFrenchCopy(trimmed)) {
    return undefined;
  }

  let translated = trimmed;
  for (const [pattern, replacement] of FRENCH_PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  translated = translated.replace(/\s+/g, ' ').trim();

  if (!translated || isLikelyFrenchCopy(translated)) {
    return undefined;
  }
  return translated;
}

/**
 * Results/Detail short copy for the NL UI.
 * Prefer stored Dutch locale text; translate known BE-FR enrichment phrases;
 * never show raw French marketing copy.
 */
export function cardBlurbForDutchUi(
  offer: TravelOffer,
  shortText: string | undefined,
  options?: { allowLocalizedFallback?: boolean },
): string | undefined {
  const trimmed = shortText?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (options?.allowLocalizedFallback !== false) {
    const dutch = preferredDutchLocalizedText(offer.localizedDescriptions);
    if (dutch && !isLikelyFrenchCopy(dutch)) {
      return dutch;
    }
  }

  if (isLikelyFrenchCopy(trimmed)) {
    return translateFrenchCatalogPhraseToDutch(trimmed);
  }

  return trimmed;
}

/** Detail catalog copy: use stored Dutch locale text when the union kept it. */
export function preferredDutchCatalogCopy(offer: TravelOffer): string | undefined {
  const localized = preferredDutchLocalizedText(offer.localizedDescriptions);
  if (localized && !isLikelyFrenchCopy(localized)) {
    return localized;
  }
  const longCopy = offer.descriptionLong?.trim() || offer.feedDescription?.trim();
  if (isLikelyFrenchCopy(longCopy)) {
    return translateFrenchCatalogPhraseToDutch(longCopy) ?? undefined;
  }
  return longCopy;
}

/** Board label for NL Results: canonical Dutch when known (incl. BE-FR serviceType). */
export function boardTypeLabelForDutchUi(boardType: string | undefined): string | undefined {
  const trimmed = boardType?.trim();
  if (!trimmed) {
    return undefined;
  }
  const canonical = canonicalizeBoardType(trimmed);
  if (canonical) {
    return canonical;
  }
  if (isLikelyFrenchCopy(trimmed)) {
    return translateFrenchCatalogPhraseToDutch(trimmed);
  }
  return trimmed;
}

/** Room/extraInfo line for NL Results: Dutch preferred, BE-FR enrichment translated. */
export function extraInfoLabelForDutchUi(
  offer: TravelOffer,
  extraInfo: string | undefined,
): string | undefined {
  return cardBlurbForDutchUi(offer, extraInfo, { allowLocalizedFallback: false });
}
