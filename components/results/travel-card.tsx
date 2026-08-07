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
import { TravelOffer } from '@/types/travel';
import Link from 'next/link';

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
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [offer.imageUrl, offer.imageLarge, ...(offer.images ?? [])]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
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

export function TravelCard({ offer }: { offer: TravelOffer }) {
  const location = [offer.destinationRegion || offer.destinationCity, offer.destinationCountry]
    .filter(Boolean)
    .join(', ');
  const stars = offer.stars && offer.stars > 0 ? offer.stars : 0;
  const isLastMinute = offer.lastMinute === 'true' || offer.lastMinute === '1' || offer.lastMinute === 'yes';
  const ratingText = ratingLabel(offer.rating);
  const airport = offer.departureAirport || offer.departureAirportCode || offer.airport;
  const images = collectImages(offer);

  const metaLine = [
    `${offer.nights} nachten`,
    offer.boardType,
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
            alt={offer.hotelName}
            isLastMinute={isLastMinute}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:px-5 sm:py-4 md:flex-row md:gap-6">
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[18.5px] font-bold leading-snug text-[#0A2D62] sm:text-[19.5px]">
                {offer.hotelName}
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

            {metaLine ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-[#475569]">{metaLine}</p>
            ) : null}

            {offer.departureDate ? (
              <p className="mt-1 text-[12.5px] text-[#64748B]">
                Vertrek tussen {offer.departureDate}
              </p>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col items-end justify-between border-t border-[#EDE8E0] pt-3 md:w-[158px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div className="flex w-full items-start justify-end">
              <HeartButton />
            </div>
            <div className="mt-1 flex w-full flex-1 flex-col items-end justify-center text-right">
              <p className="text-[28px] font-bold leading-none tracking-tight" style={{ color: RESULTS_NAVY }}>
                €&nbsp;{formatPrice(offer.price)}
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-[#94A3B8]">p.p.</p>
              <p className="mt-2 text-[11px] font-normal text-[#A39A8C]">
                € {formatPrice(offer.pricePerDay)} p.p. / dag
              </p>
            </div>
            <div className="mt-3 w-full">
              <Link
                href={`/offers/${offer.id}`}
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
