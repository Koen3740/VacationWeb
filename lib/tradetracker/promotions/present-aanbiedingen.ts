import type { AanbiedingenCard } from './compose-aanbiedingen';
import { isOwnCreativeImageUrl } from './creative-image-path';
import { corendonHomepageActions } from './corendon-homepage-actions';
import { isRejectedGenericLastminuteMaterial } from './displayable-offer';
import { editorialOffersFromCards, type EditorialOffer } from './editorial-offers';
import { sortOffersNewestFirst } from './sort-offers';
import type { VacationWebPromotionMarket } from './select-displayable';
import { compareCalendarDates, toCalendarDate, utcCalendarDate } from './validity';

const ACTION_PATHS = new Set(['/winterzon', '/topdeals']);

function actionPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    const encoded = url.searchParams.get('u');
    const target = encoded ? new URL(encoded) : url;
    return ACTION_PATHS.has(target.pathname) ? target.pathname : null;
  } catch {
    return null;
  }
}

function ended(expirationDate: string | null, asOfMs: number): boolean {
  const end = toCalendarDate(expirationDate);
  if (!end) {
    return false;
  }
  return compareCalendarDates(utcCalendarDate(asOfMs), end) > 0;
}

function allowedProvider(name: string): boolean {
  return name === 'Corendon' || name === 'Sunweb' || name === 'Eliza was here';
}

function cardActionPath(card: AanbiedingenCard): string | null {
  return actionPath(card.clickUrl) ?? actionPath(card.campaignUrl);
}

function offerActionPath(offer: EditorialOffer): string | null {
  return actionPath(offer.clickUrl) ?? actionPath(offer.conditionsUrl);
}

/**
 * Own-storage image for a known homepage landing.
 * The creative does not have to be a separate offer: a concrete benefit can
 * already live on the curated action. Rejected last-minute materials, expired
 * rows, and anything that is not VacationWeb creative storage are ignored.
 */
function landingImages(
  cards: readonly AanbiedingenCard[],
  asOfMs: number,
): Map<string, { imageUrl: string; imageAlt: string }> {
  const eligible = cards.flatMap((card) => {
    if (isRejectedGenericLastminuteMaterial(card.materialItemId) || !allowedProvider(card.providerName)) {
      return [];
    }
    if (ended(card.expirationDate, asOfMs)) {
      return [];
    }
    const path = cardActionPath(card);
    if (!path || !card.imageUrl || !isOwnCreativeImageUrl(card.imageUrl)) {
      return [];
    }
    return [
      {
        card,
        id: card.id,
        publishedAt: card.publishDate,
        validFrom: null,
        ingestedAt: card.ingestedAt ?? null,
        path,
      },
    ];
  });
  const images = new Map<string, { imageUrl: string; imageAlt: string }>();
  for (const item of sortOffersNewestFirst(eligible)) {
    if (images.has(item.path) || !item.card.imageUrl) {
      continue;
    }
    images.set(item.path, { imageUrl: item.card.imageUrl, imageAlt: item.card.title });
  }
  return images;
}

/**
 * Homepage actions stay on the page. A TradeTracker creative for the same
 * landing contributes its allowed image and is not shown a second time.
 * Every other concrete stream offer is added as its own wide card.
 */
export function presentAanbiedingenOffers(
  market: VacationWebPromotionMarket,
  cards: readonly AanbiedingenCard[],
  asOfMs = Date.now(),
): EditorialOffer[] {
  const images = landingImages(cards, asOfMs);
  const curated = corendonHomepageActions(market).map((offer) => {
    const image = images.get(actionPath(offer.clickUrl) ?? '');
    if (!image) {
      return offer;
    }
    return { ...offer, imageUrl: image.imageUrl, imageAlt: image.imageAlt || offer.imageAlt };
  });
  const curatedPaths = new Set(
    curated.map((offer) => actionPath(offer.clickUrl)).filter((path): path is string => Boolean(path)),
  );
  const stream = editorialOffersFromCards(cards, asOfMs).filter((offer) => {
    const path = offerActionPath(offer);
    return !path || !curatedPaths.has(path);
  });
  return sortOffersNewestFirst([...curated, ...stream]);
}
