import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfferImageGallery } from '@/components/offers/offer-image-gallery';
import { loadOfferById } from '@/lib/offers/load-offer-by-id';
import type { TravelOffer } from '@/types/travel';

export const dynamic = 'force-dynamic';

function buildGalleryImages(offer: TravelOffer): string[] {
  const primary = offer.imageLarge || offer.imageUrl || '';
  const candidates = [primary, ...(offer.images ?? [])];
  const seen = new Set<string>();
  const images: string[] = [];

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    images.push(url);
  }

  return images;
}

function formatDestination(offer: TravelOffer): string {
  const parts = [
    offer.destinationCity,
    offer.destinationRegion,
    offer.destinationProvince,
    offer.destinationCountry,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.filter((part, index) => part !== parts[index - 1]).join(', ');
}

function formatDepartureDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function normalizeDescriptionText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getUniqueFeedDescription(offer: TravelOffer): string | undefined {
  const feedDescription = offer.feedDescription?.trim();
  if (!feedDescription) {
    return undefined;
  }

  const feedNormalized = normalizeDescriptionText(feedDescription);
  const shortNormalized = normalizeDescriptionText(offer.descriptionShort);
  const longNormalized = normalizeDescriptionText(offer.descriptionLong);

  if (shortNormalized && feedNormalized === shortNormalized) {
    return undefined;
  }

  if (longNormalized && feedNormalized === longNormalized) {
    return undefined;
  }

  return feedDescription;
}

function formatFlightIncluded(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'ja' || normalized === '1') {
    return 'Vlucht inbegrepen';
  }
  if (normalized === 'false' || normalized === 'nee' || normalized === '0') {
    return 'Zonder vlucht';
  }

  return value.trim();
}

function formatDurationType(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatDepartureAirport(offer: TravelOffer): string | undefined {
  const airport = offer.departureAirport?.trim();
  const code = offer.departureAirportCode?.trim();

  if (airport && code && airport.toUpperCase() !== code.toUpperCase()) {
    return `${airport} (${code})`;
  }

  return airport || code || undefined;
}

function formatAdditionalAirport(offer: TravelOffer): string | undefined {
  const airport = offer.airport?.trim();
  if (!airport) {
    return undefined;
  }

  const departure = offer.departureAirport?.trim();
  if (!departure) {
    return airport;
  }

  const airportLower = airport.toLowerCase();
  const departureLower = departure.toLowerCase();
  if (
    airportLower === departureLower
    || departureLower.includes(airportLower)
    || airportLower.includes(departureLower)
  ) {
    return undefined;
  }

  return airport;
}

export default async function OfferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const offerId = decodeURIComponent(params.id);
  const offer = await loadOfferById(offerId);

  if (!offer) {
    notFound();
  }

  const themes = (offer.subcategories ?? '')
    .split(',')
    .map((theme) => theme.trim())
    .filter((theme) => theme.length > 0);

  const isLastMinute = (offer.lastMinute ?? '').toLowerCase() === 'true';
  const hasAttributes = themes.length > 0 || isLastMinute;

  const galleryImages = buildGalleryImages(offer);
  const destination = formatDestination(offer);
  const hasStars = typeof offer.stars === 'number' && offer.stars > 0;
  const hasRating = typeof offer.rating === 'number';
  const uniqueFeedDescription = getUniqueFeedDescription(offer);

  const departureAirportLabel = formatDepartureAirport(offer);
  const additionalAirport = formatAdditionalAirport(offer);
  const flightIncludedLabel = formatFlightIncluded(offer.flightIncluded);
  const durationTypeLabel = formatDurationType(offer.durationType);

  const basisFacts = [
    { label: 'Aanbieder', value: offer.provider },
    { label: 'Stad', value: offer.destinationCity },
    { label: 'Regio', value: offer.destinationRegion },
    { label: 'Provincie', value: offer.destinationProvince },
    { label: 'Land', value: offer.destinationCountry },
    { label: 'Verzorging', value: offer.boardType },
    { label: 'Accommodatie', value: offer.accommodation },
    { label: 'Accommodatietype', value: offer.accommodationType },
    { label: 'Aantal nachten', value: offer.nights ? `${offer.nights} nachten` : undefined },
    { label: 'Duurtype', value: durationTypeLabel },
    { label: 'Vlucht', value: flightIncludedLabel },
    {
      label: 'Vertrekdatum',
      value: offer.departureDate ? formatDepartureDate(offer.departureDate) : undefined,
    },
    { label: 'Vertrekluchthaven', value: departureAirportLabel },
    { label: 'Luchthaven', value: additionalAirport },
    { label: 'Beoordeling', value: hasRating ? String(offer.rating) : undefined },
  ].filter((fact) => Boolean(fact.value));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <Link
          href="/results"
          className="text-sm font-semibold text-brand-700"
        >
          ← Terug naar resultaten
        </Link>

        <OfferImageGallery images={galleryImages} alt={offer.hotelName} />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-700">
                  {offer.provider}
                </p>

                <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl">
                  {offer.hotelName}
                </h1>

                {destination ? (
                  <p className="mt-2 text-slate-600">
                    {destination}
                  </p>
                ) : null}
              </div>

              {hasStars ? (
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {offer.stars} sterren
                </div>
              ) : null}
            </div>

            {basisFacts.length > 0 ? (
              <div className="mt-8">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                  Basisinformatie
                </p>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {basisFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="rounded-2xl bg-slate-50 px-4 py-3"
                    >
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {hasAttributes && (
              <div className="mt-8">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                  Kenmerken
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {isLastMinute && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                      Last minute
                    </span>
                  )}

                  {themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full bg-slate-100 px-3 py-1 text-slate-700"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(offer.descriptionShort || offer.descriptionLong || uniqueFeedDescription) && (
              <div className="mt-8 space-y-4">
                {offer.descriptionShort && (
                  <p className="text-base leading-7 text-slate-700">
                    {offer.descriptionShort}
                  </p>
                )}

                {offer.descriptionLong && (
                  <p className="text-base leading-7 text-slate-600">
                    {offer.descriptionLong}
                  </p>
                )}

                {uniqueFeedDescription ? (
                  <p className="text-base leading-7 text-slate-600">
                    {uniqueFeedDescription}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                Prijsoverzicht
              </p>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">
                    Totaalprijs
                  </p>

                  <p className="text-4xl font-semibold text-slate-950">
                    €{offer.price}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    Prijs per dag
                  </p>

                  <p className="text-2xl font-semibold text-brand-700">
                    €{offer.pricePerDay}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                {offer.departureDate ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Vertrekdatum</span>
                    <span className="font-semibold">
                      {formatDepartureDate(offer.departureDate)}
                    </span>
                  </div>
                ) : null}

                {departureAirportLabel ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Vertrekluchthaven</span>
                    <span className="font-semibold">
                      {departureAirportLabel}
                    </span>
                  </div>
                ) : null}

                {additionalAirport ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Luchthaven</span>
                    <span className="font-semibold">
                      {additionalAirport}
                    </span>
                  </div>
                ) : null}

                {offer.nights ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Aantal nachten</span>
                    <span className="font-semibold">
                      {offer.nights} nachten
                    </span>
                  </div>
                ) : null}

                {durationTypeLabel ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Duurtype</span>
                    <span className="font-semibold">
                      {durationTypeLabel}
                    </span>
                  </div>
                ) : null}

                {flightIncludedLabel ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Vlucht</span>
                    <span className="font-semibold">
                      {flightIncludedLabel}
                    </span>
                  </div>
                ) : null}

                {offer.boardType ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Verzorging</span>
                    <span className="font-semibold">
                      {offer.boardType}
                    </span>
                  </div>
                ) : null}

                {offer.accommodation ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Accommodatie</span>
                    <span className="font-semibold">
                      {offer.accommodation}
                    </span>
                  </div>
                ) : null}

                {offer.accommodationType ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Accommodatietype</span>
                    <span className="font-semibold">
                      {offer.accommodationType}
                    </span>
                  </div>
                ) : null}

                {hasRating ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Beoordeling</span>
                    <span className="font-semibold">
                      {offer.rating}
                    </span>
                  </div>
                ) : null}

                {offer.extraInfo ? (
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Kamertype</span>
                    <span className="font-semibold">
                      {offer.extraInfo}
                    </span>
                  </div>
                ) : null}
              </div>

              <a
                href={offer.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex w-full justify-center rounded-full bg-brand-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-brand-700"
              >
                Boek bij {offer.provider}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
