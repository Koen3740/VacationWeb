import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_CARD_SHADOW,
  RESULTS_CTA,
  RESULTS_CTA_HOVER,
  RESULTS_NAVY,
  RESULTS_RATING_GREEN,
  RESULTS_STAR_GOLD,
} from '@/components/results-v2/results-design-tokens';
import { TravelCardGallery } from '@/components/results/travel-card-gallery';
import { collectOrderedOfferImages } from '@/lib/offers/offer-images';
import { displayHotelName } from '@/lib/offers/display-hotel-name';
import { carRentalIncludedLabel } from '@/lib/offers/has-car-rental';
import { formatNightsLabel } from '@/lib/offers/offer-detail-view';
import { buildOfferDetailHref } from '@/lib/search/pagination';
import { formatOfferDepartureAirportLabel } from '@/lib/search/departure-airports';
import { formatDeparturePresentation } from '@/lib/search/departure-presentation';
import {
  RESULTS_PRICE_COPY,
  hasValidPresentablePrice,
  isResultsListableOffer,
  isUnpricedResultsOffer,
  resultsPricePresentation,
} from '@/lib/search/presentable-price';
import {
  boardTypeLabelForDutchUi,
  cardBlurbForDutchUi,
  extraInfoLabelForDutchUi,
  preferredDutchLocalizedText,
} from '@/lib/offers/ui-locale';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import type { SearchParams, TravelOffer } from '@/types/travel';
import Link from 'next/link';
import React from 'react';

function ratingLabel(rating: number | null | undefined): string {
  if (rating == null) return '';
  if (rating >= 9) return 'Fantastisch';
  if (rating >= 8) return 'Uitstekend';
  if (rating >= 7) return 'Zeer goed';
  return 'Goed';
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
}

function collectImages(offer: TravelOffer): string[] {
  return collectOrderedOfferImages(offer);
}

/** Plain-text snippet from feed text fields (no descriptionLong). */
function plainTextSnippet(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const text = trimmed
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&apos;/gi, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

  return text || undefined;
}

function flightIncludedLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true' || normalized === 'ja' || normalized === '1') {
    return 'Inclusief vlucht';
  }
  return undefined;
}

function subcategoryLabels(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(',')) {
    const label = part.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 3) break;
  }
  return out;
}

function HeartButton() {
  return (
    <span
      aria-hidden
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0A2D62]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 20.5 5.5 13.8a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.4 0L12 7.1l.1-.1a4.5 4.5 0 0 1 6.4 0 4.7 4.7 0 0 1 0 6.6L12 20.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Prefer island/province over broad archipelago region labels (e.g. Balearen → Mallorca). */
function formatCardLocation(offer: TravelOffer): string {
  const region = canonicalizeRegionName(offer.destinationRegion);
  const province = offer.destinationProvince?.trim() || '';
  const city = offer.destinationCity?.trim() || '';
  const country = canonicalizeCountryName(offer.destinationCountry?.trim() || '');

  const ARCHIPELAGO_REGIONS = new Set([
    'balearen',
    'canarische eilanden',
    'canaries',
    'canary islands',
  ]);

  const regionIsArchipelago = ARCHIPELAGO_REGIONS.has(region.toLowerCase());
  const primary =
    regionIsArchipelago && province
      ? province
      : region || city;

  return [primary, country].filter(Boolean).join(', ');
}

function isCardBlurbUseful(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  // Bare occupancy / room codes must not appear as description lines.
  if (/^\d{1,3}$/.test(trimmed)) return false;
  return trimmed.length >= 3;
}

export function TravelCard({
  offer,
  provisional = false,
  searchParams,
}: {
  offer: TravelOffer;
  provisional?: boolean;
  searchParams?: SearchParams;
}) {
  if (!isResultsListableOffer(offer)) {
    return null;
  }
  // Settled paint: only B. Catalog/provisional may show pending; never catalog €.
  if (!provisional && !hasValidPresentablePrice(offer)) {
    return null;
  }
  const priceKind = (() => {
    if (hasValidPresentablePrice(offer)) {
      return 'amount' as const;
    }
    if (
      provisional &&
      offer.livePriceStatus !== 'unpriced' &&
      offer.livePriceStatus !== 'unavailable'
    ) {
      return 'pending' as const;
    }
    const presentation = resultsPricePresentation(offer, { provisional });
    if (presentation === 'unpriced' || isUnpricedResultsOffer(offer)) {
      return 'unpriced' as const;
    }
    if (presentation === 'pending') {
      return 'pending' as const;
    }
    return 'unavailable' as const;
  })();

  const location = formatCardLocation(offer);
  const stars = offer.stars && offer.stars > 0 ? offer.stars : 0;
  const isLastMinute = offer.lastMinute === 'true' || offer.lastMinute === '1' || offer.lastMinute === 'yes';
  const ratingText = ratingLabel(offer.rating);
  const airport = formatOfferDepartureAirportLabel(offer);
  const images = collectImages(offer);
  const departurePhrase = formatDeparturePresentation(searchParams, offer.departureDate).phrase;
  const localizedDutch = preferredDutchLocalizedText(offer.localizedDescriptions);
  const shortDescriptionRaw = cardBlurbForDutchUi(
    offer,
    plainTextSnippet(localizedDutch || offer.descriptionShort),
    { allowLocalizedFallback: true },
  );
  const extraInfoRaw = extraInfoLabelForDutchUi(offer, plainTextSnippet(offer.extraInfo));
  const shortDescription = isCardBlurbUseful(shortDescriptionRaw) ? shortDescriptionRaw : undefined;
  const extraInfo =
    isCardBlurbUseful(extraInfoRaw) &&
    extraInfoRaw?.trim().toLowerCase() !== shortDescription?.trim().toLowerCase()
      ? extraInfoRaw
      : undefined;
  const accommodationType = offer.accommodationType?.trim() || undefined;
  const flightLabel = flightIncludedLabel(offer.flightIncluded);
  const carRentalLabel = carRentalIncludedLabel(offer);
  const themes = subcategoryLabels(offer.subcategories);
  const publicHotelName = displayHotelName(offer);
  const boardLabel = boardTypeLabelForDutchUi(offer.boardType);
  const detailHref = searchParams
    ? buildOfferDetailHref(offer.id, searchParams)
    : `/offers/${encodeURIComponent(offer.id)}`;

  const metaLine = [
    accommodationType,
    formatNightsLabel(offer.nights, offer.durationType, offer.provider),
    boardLabel,
    flightLabel,
    airport,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <article
      className="overflow-hidden rounded-[16px] border"
      style={{
        backgroundColor: RESULTS_CARD_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <div className="flex flex-col md:flex-row">
        <div className="relative w-full shrink-0 md:w-[320px] lg:w-[340px]">
          <TravelCardGallery
            images={images}
            alt={publicHotelName}
            isLastMinute={isLastMinute}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:px-5 sm:py-4 md:flex-row md:gap-6">
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[18.5px] font-bold leading-snug text-[#0A2D62] sm:text-[19.5px]">
                {publicHotelName}
              </h3>
              {stars > 0 ? (
                <span
                  className="text-[16px] leading-none tracking-tight"
                  style={{ color: RESULTS_STAR_GOLD }}
                  aria-label={`${stars} sterren`}
                >
                  {'★'.repeat(stars)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[13px] text-[#64748B]">{location}</p>

            {shortDescription ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#64748B]">
                {shortDescription}
              </p>
            ) : null}

            {extraInfo ? (
              <p className="mt-1 line-clamp-1 text-[12.5px] leading-snug text-[#64748B]">
                {extraInfo}
              </p>
            ) : null}

            {offer.rating != null ? (
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className="inline-flex h-6 min-w-[1.85rem] items-center justify-center rounded-[5px] px-1.5 text-[12px] font-bold text-white"
                  style={{ backgroundColor: RESULTS_RATING_GREEN }}
                >
                  {String(offer.rating).replace('.', ',')}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: RESULTS_RATING_GREEN }}>
                  {ratingText}
                </span>
              </div>
            ) : null}

            {carRentalLabel ? (
              <p className="mt-2.5">
                <span
                  className="inline-flex items-center rounded-[8px] border border-[#C5D6EA] bg-[#EFF5FB] px-2.5 py-1 text-[12.5px] font-semibold text-[#0A2D62]"
                  title="Transport: huurauto inbegrepen bij dit pakket"
                >
                  {carRentalLabel}
                </span>
              </p>
            ) : null}

            {metaLine ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-[#475569]">{metaLine}</p>
            ) : null}

            {themes.length > 0 ? (
              <p className="mt-1 text-[12.5px] leading-snug text-[#64748B]">{themes.join(' • ')}</p>
            ) : null}

            {departurePhrase ? (
              <p className="mt-1 text-[12.5px] text-[#64748B]">{departurePhrase}</p>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col items-end justify-between border-t border-[#EDE8E0] pt-3 md:w-[158px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div className="flex w-full items-start justify-end">
              <HeartButton />
            </div>
            <div className="mt-1 flex w-full flex-1 flex-col items-end justify-center text-right">
              {priceKind === 'pending' ? (
                <p className="text-[13px] font-medium leading-snug text-[#64748B]">
                  {RESULTS_PRICE_COPY.pending}
                </p>
              ) : priceKind === 'unpriced' ? (
                <p className="text-[13px] font-medium leading-snug text-[#64748B]">
                  {RESULTS_PRICE_COPY.unpriced}
                </p>
              ) : priceKind !== 'amount' ? (
                <p className="text-[13px] font-medium leading-snug text-[#64748B]">
                  {RESULTS_PRICE_COPY.unavailable}
                </p>
              ) : (
                <>
                  <p className="text-[28px] font-bold leading-none tracking-tight" style={{ color: RESULTS_NAVY }}>
                    €&nbsp;{formatPrice(offer.price)}
                  </p>
                  <p className="mt-1.5 text-[12px] font-medium text-[#94A3B8]">p.p.</p>
                  <p className="mt-2 text-[11px] font-normal text-[#A39A8C]">
                    € {formatPrice(offer.pricePerDay)} p.p. / dag
                  </p>
                </>
              )}
            </div>
            <div className="mt-3 w-full">
              <Link
                href={detailHref}
                className="inline-flex h-10 w-full items-center justify-center rounded-[11px] text-[13px] font-semibold text-white transition"
                style={{ backgroundColor: RESULTS_CTA }}
              >
                Bekijk aanbieding
              </Link>
              <p className="mt-1.5 text-center text-[11.5px] font-medium" style={{ color: RESULTS_CTA_HOVER }}>
                Bekijk bij {offer.provider}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
