import { FavoriteHeartButton } from '@/components/favorites/favorite-heart-button';
import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_CARD_SHADOW,
  RESULTS_CTA,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_RATING_GREEN,
  RESULTS_STAR_GOLD,
} from '@/components/results-v2/results-design-tokens';
import { TravelCardGallery } from '@/components/results/travel-card-gallery';
import { collectCardHighlights } from '@/lib/offers/card-highlights';
import { catalogReturnDateOffsetDays } from '@/lib/offers/duration-semantics';
import { collectOrderedOfferImages } from '@/lib/offers/offer-images';
import { displayHotelName } from '@/lib/offers/display-hotel-name';
import { formatNightsLabel } from '@/lib/offers/offer-detail-view';
import { buildOfferDetailHref } from '@/lib/search/pagination';
import { displayAccommodationTypeForCard } from '@/lib/search/accommodation-type-filter';
import { formatOfferDepartureAirportLabel } from '@/lib/search/departure-airports';
import { normalizeDepartureDateToIso } from '@/lib/search/departure-date';
import { occupancyAgeCountsFromSearchParams } from '@/lib/search/occupancy-category';
import {
  RESULTS_PRICE_COPY,
  hasValidPresentablePrice,
  isResultsListableOffer,
  isUnpricedResultsOffer,
  resultsPricePresentation,
} from '@/lib/search/presentable-price';
import { boardTypeLabelForDutchUi } from '@/lib/offers/ui-locale';
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
  // Catalog already caps Results galleries; slice again so UI never exceeds 5.
  return collectOrderedOfferImages(offer).slice(0, 5);
}

function flightIncludedLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true' || normalized === 'ja' || normalized === '1') {
    return 'Inclusief vlucht';
  }
  return undefined;
}

/** Land → Regio → Plaats (e.g. Spanje · Costa Brava · Santa Susanna). */
function formatCardLocationHierarchy(offer: TravelOffer): string {
  const country = canonicalizeCountryName(offer.destinationCountry?.trim() || '');
  const region = canonicalizeRegionName(offer.destinationRegion);
  const province = offer.destinationProvince?.trim() || '';
  const city = offer.destinationCity?.trim() || '';

  const ARCHIPELAGO_REGIONS = new Set([
    'balearen',
    'canarische eilanden',
    'canaries',
    'canary islands',
  ]);

  const regionIsArchipelago = ARCHIPELAGO_REGIONS.has(region.toLowerCase());
  const regionLabel = regionIsArchipelago && province ? province : region;

  return [country, regionLabel, city].filter(Boolean).join(' · ');
}

function resolveCardDepartureIso(
  params: Pick<SearchParams, 'departureStart' | 'departureEnd'> | undefined,
  offerDepartureDate: string | undefined,
): string | undefined {
  const offerIso = normalizeDepartureDateToIso(offerDepartureDate);
  if (offerIso) {
    return offerIso;
  }
  const start = normalizeDepartureDateToIso(params?.departureStart);
  const end = normalizeDepartureDateToIso(params?.departureEnd) ?? start;
  return start ?? end ?? undefined;
}

function formatCardDateCompact(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Stay period using catalog return-date offset (same semantics as Detail). */
function formatCardStayPeriodLabel(
  offer: TravelOffer,
  searchParams: SearchParams | undefined,
): string | undefined {
  const startIso = resolveCardDepartureIso(searchParams, offer.departureDate);
  if (!startIso) {
    return undefined;
  }
  const offsetDays = catalogReturnDateOffsetDays(offer);
  if (!offsetDays) {
    return formatCardDateCompact(startIso);
  }
  const [year, month, day] = startIso.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month - 1, day));
  endDate.setUTCDate(endDate.getUTCDate() + offsetDays);
  const endIso = endDate.toISOString().slice(0, 10);
  const startLabel = formatCardDateCompact(startIso);
  const endLabel = formatCardDateCompact(endIso);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

function formatCardPartySummary(params: SearchParams | undefined): string | undefined {
  if (!params) {
    return undefined;
  }
  const counts = occupancyAgeCountsFromSearchParams(params);
  if (counts.persons <= 0) {
    return undefined;
  }
  return counts.persons === 1 ? '1 persoon' : `${counts.persons} personen`;
}

function formatCardTripSummary(
  airport: string | undefined,
  partySummary: string | undefined,
): string | undefined {
  const airportPart = airport ? `vanaf ${airport}` : undefined;
  return [airportPart, partySummary].filter(Boolean).join(' · ') || undefined;
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

  const location = formatCardLocationHierarchy(offer);
  const stars = offer.stars && offer.stars > 0 ? offer.stars : 0;
  const isLastMinute = offer.lastMinute === 'true' || offer.lastMinute === '1' || offer.lastMinute === 'yes';
  const ratingText = ratingLabel(offer.rating);
  const hasRating = offer.rating != null && Number.isFinite(offer.rating);
  const airport = formatOfferDepartureAirportLabel(offer);
  const images = collectImages(offer);
  const accommodationType = displayAccommodationTypeForCard(offer.accommodationType);
  const flightLabel = flightIncludedLabel(offer.flightIncluded);
  const highlights = collectCardHighlights(offer);
  const publicHotelName = displayHotelName(offer);
  const boardLabel = boardTypeLabelForDutchUi(offer.boardType);
  const detailHref = searchParams
    ? buildOfferDetailHref(offer.id, searchParams)
    : `/offers/${encodeURIComponent(offer.id)}`;

  const stayPeriodLabel = formatCardStayPeriodLabel(offer, searchParams);
  const partySummary = formatCardPartySummary(searchParams);
  const tripSummary = formatCardTripSummary(airport, partySummary);

  const metaLine = [
    accommodationType,
    formatNightsLabel(offer.nights, offer.durationType, offer.provider),
    boardLabel,
    flightLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className="overflow-hidden rounded-[16px] border"
      style={{
        backgroundColor: RESULTS_CARD_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <div className="flex flex-col md:flex-row md:items-start">
        <div className="relative w-full shrink-0 self-start md:w-[320px] lg:w-[340px]">
          <TravelCardGallery
            images={images}
            alt={publicHotelName}
            isLastMinute={isLastMinute}
          />
          <div className="absolute right-2.5 top-2.5 z-[3]">
            <FavoriteHeartButton
              offer={{
                id: offer.id,
                hotelName: publicHotelName,
                imageUrl: images[0] || offer.imageUrl,
                provider: offer.provider,
                price: hasValidPresentablePrice(offer) ? offer.price : undefined,
                destinationCountry: offer.destinationCountry,
                destinationRegion: offer.destinationRegion,
                destinationCity: offer.destinationCity,
              }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch md:gap-5 lg:gap-6">
          <div className="min-w-0 flex-1 px-4 py-4 sm:px-5 sm:py-4 md:pr-0">
            <div>
              <h3 className="text-[18.5px] font-bold leading-snug text-[#0A2D62] sm:text-[19.5px]">
                {publicHotelName}
                {stars > 0 ? (
                  <span
                    className="ml-1.5 inline whitespace-nowrap align-baseline text-[16px] leading-none tracking-tight"
                    style={{ color: RESULTS_STAR_GOLD }}
                    aria-label={`${stars} sterren`}
                  >
                    {'★'.repeat(stars)}
                  </span>
                ) : null}
              </h3>

              {location ? (
                <p className="mt-0.5 text-[13px] text-[#64748B]">{location}</p>
              ) : null}

              {metaLine ? (
                <p className="mt-2 text-[13px] leading-relaxed text-[#475569]">{metaLine}</p>
              ) : null}
            </div>

            {highlights.length > 0 ? (
              <ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-2">
                {highlights.map((label) => (
                  <li
                    key={label}
                    className="flex min-w-0 items-start gap-1.5 text-[12.5px] leading-snug text-[#475569]"
                  >
                    <span className="shrink-0 font-semibold text-[#2F8F78]" aria-hidden>
                      ✓
                    </span>
                    <span className="min-w-0">{label}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {stayPeriodLabel || tripSummary ? (
              <div className="mt-5 space-y-0.5 text-[12.5px] leading-snug text-[#64748B]">
                {stayPeriodLabel ? <p>{stayPeriodLabel}</p> : null}
                {tripSummary ? <p>{tripSummary}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col border-t border-[#EDE8E0] px-4 py-4 sm:px-5 md:w-[158px] md:justify-between md:border-l md:border-t-0 md:px-4 lg:w-[172px]">
            <div className="text-right">
              {hasRating ? (
                <p
                  className="whitespace-nowrap text-[12.5px] font-medium leading-tight"
                  style={{ color: RESULTS_RATING_GREEN }}
                  data-testid="travel-card-rating"
                >
                  <span className="font-semibold">{String(offer.rating).replace('.', ',')}</span>
                  {ratingText ? ` ${ratingText}` : ''}
                </p>
              ) : null}

              <div className={hasRating ? 'mt-2.5' : ''}>
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
            </div>

            <div className="mt-4 w-full md:mt-0">
              <Link
                href={detailHref}
                className="inline-flex h-10 w-full items-center justify-center rounded-[11px] text-[13px] font-semibold text-white transition"
                style={{ backgroundColor: RESULTS_CTA }}
              >
                Bekijk aanbieding
              </Link>
              <p className="mt-1.5 text-center text-[11.5px] font-medium" style={{ color: RESULTS_MUTED }}>
                Aangeboden door {offer.provider}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
