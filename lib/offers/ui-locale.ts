import type { TravelOffer } from '@/types/travel';

const DUTCH_LOCALES = ['nl-NL', 'nl-BE'] as const;

const FRENCH_COPY_MARKERS =
  /l['’]hôtel|situé|est un |à seulement|ses clients|sous le soleil|anciennement|bénéficient|magnifique hôtel|chambre double|tout compris|se trouvent|à côté|vous pouvez|depuis la|les merveilleux|ensoleillée|au bord de la|la promenade/i;

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

/**
 * Results/Detail short copy for the NL UI.
 * Prefer stored Dutch locale text; never show raw BE-FR / French marketing copy.
 * No external translator — hide FR when no Dutch source text exists.
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
    return undefined;
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
    return undefined;
  }
  return longCopy;
}
