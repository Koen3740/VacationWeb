import { FavoriteHeartButton } from '@/components/favorites/favorite-heart-button';
import {
  RESULTS_RATING_GREEN,
  RESULTS_STAR_GOLD,
} from '@/components/results-v2/results-design-tokens';
import { TravelCardGallery } from '@/components/results/travel-card-gallery';
import { collectCardHighlights, layoutCardHighlightSlots } from '@/lib/offers/card-highlights';
import { catalogReturnDateIso } from '@/lib/offers/duration-semantics';
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
  // Use every catalog URL already on the TravelOffer — no arbitrary Results cap.
  return collectOrderedOfferImages(offer);
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
  const endIso = catalogReturnDateIso(offer, startIso);
  if (!endIso) {
    return formatCardDateCompact(startIso);
  }
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
  // Presentable pool only (B). A / C / Pending / parked → no Results card.
  // They stay in the underlying matchset for later pricing retries.
  if (!isResultsListableOffer(offer)) {
    return null;
  }
  const priceKind = resultsPricePresentation(offer, { provisional });

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
  const highlightSlots = layoutCardHighlightSlots(highlights);
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
      className="group relative grid grid-cols-[38%_minmax(0,1fr)] overflow-hidden rounded-vw-card border border-vw-line bg-vw-card shadow-vw-card min-[901px]:grid-cols-[40%_minmax(0,1fr)] min-[901px]:min-h-[290px]"
      data-testid="travel-card"
      data-price-presentation={priceKind}
      data-provisional={provisional ? 'true' : 'false'}
      data-live-price-status={offer.livePriceStatus ?? 'catalog'}
    >
      <div className="relative min-h-[220px] self-stretch min-[901px]:min-h-[290px]">
        <TravelCardGallery
          images={images}
          alt={publicHotelName}
          isLastMinute={isLastMinute}
          fillCardHeight
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

      <div className="grid min-w-0 grid-cols-1 min-[901px]:grid-cols-[minmax(0,1fr)_188px]">
        <div className="flex min-w-0 flex-col px-3 pb-1 pt-3 min-[901px]:px-[22px] min-[901px]:pb-[18px] min-[901px]:pt-5">
          <div>
            <h3 className="font-vw-serif text-[17px] font-medium leading-[1.2] text-vw-navy min-[901px]:text-[22px]">
              {publicHotelName}
              {stars > 0 ? (
                <span
                  className="ml-1 inline whitespace-nowrap align-baseline text-[12px] leading-none tracking-tight min-[901px]:ml-1 min-[901px]:text-[15px] max-[900px]:mt-0.5 max-[900px]:block max-[900px]:ml-0"
                  style={{ color: RESULTS_STAR_GOLD }}
                  aria-label={`${stars} sterren`}
                >
                  {'★'.repeat(stars)}
                </span>
              ) : null}
            </h3>

            {location ? (
              <p className="mt-1 text-[12px] text-vw-muted min-[901px]:text-[13px]">{location}</p>
            ) : null}

            {metaLine ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#475569] min-[901px]:mt-2.5 min-[901px]:text-[13.5px]">
                {metaLine}
              </p>
            ) : null}
          </div>

          <ul
            className="mt-4 hidden gap-x-6 gap-y-2 min-[901px]:grid min-[901px]:grid-cols-2"
            data-testid="travel-card-highlights"
          >
            {highlightSlots.map((label, slotIndex) => (
              <li
                key={label ? `${slotIndex}-${label}` : `empty-${slotIndex}`}
                className="flex min-h-[20px] items-start gap-1.5 text-[12.5px] leading-none text-[#475569]"
                aria-hidden={label ? undefined : true}
              >
                {label ? (
                  <>
                    <span className="shrink-0 font-semibold text-vw-green" aria-hidden>
                      ✓
                    </span>
                    <span className="truncate whitespace-nowrap">{label}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>

          {stayPeriodLabel || tripSummary ? (
            <div className="mt-1.5 space-y-0.5 text-[11.5px] leading-snug text-vw-muted min-[901px]:mt-4 min-[901px]:text-[12.5px]">
              {stayPeriodLabel ? <p>{stayPeriodLabel}</p> : null}
              {tripSummary ? <p>{tripSummary}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-col px-3 pb-3 pt-2 text-right min-[901px]:justify-between min-[901px]:border-l min-[901px]:border-[#eee7da] min-[901px]:px-[18px] min-[901px]:py-4">
          <div>
            <div
              className={`flex h-7 shrink-0 items-center justify-end max-[900px]:absolute max-[900px]:bottom-2 max-[900px]:left-2 max-[900px]:z-[2] max-[900px]:h-auto max-[900px]:rounded-[9px] max-[900px]:bg-white/95 max-[900px]:px-1 max-[900px]:py-0.5 ${
                hasRating ? '' : 'max-[900px]:hidden'
              }`}
              data-testid="travel-card-rating-zone"
              aria-hidden={!hasRating}
            >
              {hasRating ? (
                <div
                  className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap"
                  data-testid="travel-card-rating"
                >
                  <span
                    className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[14px] font-bold leading-none text-white max-[900px]:h-auto max-[900px]:min-w-0 max-[900px]:px-1.5 max-[900px]:py-0.5 max-[900px]:text-[12.5px]"
                    style={{ backgroundColor: RESULTS_RATING_GREEN }}
                  >
                    {String(offer.rating).replace('.', ',')}
                  </span>
                  {ratingText ? (
                    <span
                      className="truncate text-[12px] font-semibold leading-none max-[900px]:text-[11.5px]"
                      style={{ color: RESULTS_RATING_GREEN }}
                    >
                      {ratingText}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-2.5" data-testid="travel-card-price-block">
              {priceKind === 'pending' ? (
                <p className="text-[13px] font-medium leading-snug text-vw-muted">
                  {RESULTS_PRICE_COPY.pending}
                </p>
              ) : priceKind === 'unpriced' ? (
                <p className="text-[13px] font-medium leading-snug text-vw-muted">
                  {RESULTS_PRICE_COPY.unpriced}
                </p>
              ) : priceKind !== 'amount' ? (
                <p className="text-[13px] font-medium leading-snug text-vw-muted">
                  {RESULTS_PRICE_COPY.unavailable}
                </p>
              ) : (
                <>
                  <p className="font-vw-serif text-[23px] font-semibold leading-none tracking-[-0.01em] text-vw-navy min-[901px]:text-[30px]">
                    €&nbsp;{formatPrice(offer.price)}
                  </p>
                  <p className="mt-1.5 text-[12px] font-medium text-[#94A3B8]">p.p.</p>
                  <p className="mt-1.5 text-[11.5px] font-normal text-[#a39a8c]">
                    € {formatPrice(offer.pricePerDay)} p.p. / dag
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-2.5 w-full min-[901px]:mt-3">
            <Link
              href={detailHref}
              className="inline-flex h-10 w-full items-center justify-center rounded-vw-control bg-vw-cta text-[13.5px] font-semibold text-white transition hover:bg-vw-navy-hover min-[901px]:h-[42px]"
            >
              Bekijk aanbieding
            </Link>
            <p className="mt-1.5 text-center text-[11.5px] font-medium text-vw-muted">
              Aangeboden door {offer.provider}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
