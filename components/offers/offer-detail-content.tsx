import Link from 'next/link';
import { OfferImageGallery } from '@/components/offers/offer-image-gallery';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import type { CatalogRoomType, CatalogSection } from '@/lib/offers/catalog-content';
import { displayHotelName } from '@/lib/offers/display-hotel-name';
import {
  affiliateHref,
  formatAdditionalAirport,
  formatDepartureAirport,
  formatDestination,
  formatDurationType,
  formatFlightIncluded,
  formatOccupancySummary,
  formatPriceNl,
  formatTravelerLines,
  stripSimpleHtml,
} from '@/lib/offers/offer-detail-view';
import { formatDeparturePresentation } from '@/lib/search/departure-presentation';
import { RESULTS_PRICE_COPY, resultsPricePresentation } from '@/lib/search/presentable-price';
import { buildOfferDetailHref } from '@/lib/search/pagination';
import type { SearchParams, TravelOffer } from '@/types/travel';

function RoomFact({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CatalogSectionBlock({ section }: { section: CatalogSection }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
        {section.title}
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {section.items.map((item) => (
          <li
            key={`${section.title}-${item}`}
            className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 break-words"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OfferDetailContent({
  offer,
  params,
  resultsHref,
  galleryImages,
  rooms,
  selectedRoom,
  sections,
  intro,
  presentable,
  themes,
  isLastMinute,
}: {
  offer: TravelOffer;
  params: SearchParams;
  resultsHref: string;
  galleryImages: string[];
  rooms: CatalogRoomType[];
  selectedRoom: CatalogRoomType | null;
  sections: CatalogSection[];
  intro?: string;
  presentable: boolean;
  themes: string[];
  isLastMinute: boolean;
}) {
  const occupancySummary = formatOccupancySummary(params);
  const travelerLines = formatTravelerLines(params);
  const bookHref = affiliateHref(offer, params);
  const priceKind = resultsPricePresentation(offer);
  const destination = formatDestination(offer);
  const hasStars = typeof offer.stars === 'number' && offer.stars > 0;
  const hasRating = typeof offer.rating === 'number';
  const shortDescription = stripSimpleHtml(offer.descriptionShort);
  const departureAirportLabel = formatDepartureAirport(offer);
  const additionalAirport = formatAdditionalAirport(offer);
  const departurePhrase = formatDeparturePresentation(params, offer.departureDate).phrase;
  const flightIncludedLabel = formatFlightIncluded(offer.flightIncluded);
  const durationTypeLabel = formatDurationType(offer.durationType);

  return (
    <main className="min-h-screen bg-slate-50">
      <ResultsSiteHeader />

      <div className="mx-auto min-w-0 max-w-7xl overflow-x-clip px-4 py-8 sm:px-6 lg:px-8">
        <Link href={resultsHref} className="text-sm font-semibold text-brand-700">
          ← Terug naar resultaten
        </Link>

        <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-700">{offer.provider}</p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="break-words text-3xl font-semibold text-slate-950 sm:text-4xl">
                  {displayHotelName(offer)}
                </h1>
                {destination ? <p className="mt-2 text-slate-600">{destination}</p> : null}
              </div>
              {hasStars ? (
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {offer.stars} sterren
                </div>
              ) : null}
            </div>

            <OfferImageGallery images={galleryImages} alt={displayHotelName(offer)} />

            <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                Reis
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {departurePhrase ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Vertrekdatum
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {departurePhrase}
                    </dd>
                  </div>
                ) : null}
                {departureAirportLabel ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Vertrekluchthaven
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {departureAirportLabel}
                    </dd>
                  </div>
                ) : null}
                {additionalAirport ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Luchthaven
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {additionalAirport}
                    </dd>
                  </div>
                ) : null}
                {offer.nights ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Duur
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {offer.nights} nachten
                      {durationTypeLabel ? ` • ${durationTypeLabel}` : ''}
                    </dd>
                  </div>
                ) : null}
                {offer.boardType ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Verzorging
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {offer.boardType}
                    </dd>
                  </div>
                ) : null}
                {offer.accommodationType || offer.accommodation ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Accommodatie
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {[offer.accommodationType, offer.accommodation].filter(Boolean).join(' • ')}
                    </dd>
                  </div>
                ) : null}
                {flightIncludedLabel ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Vlucht
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {flightIncludedLabel}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {occupancySummary ? (
                <p className="mt-5 text-sm font-semibold text-slate-800">{occupancySummary}</p>
              ) : null}
              {travelerLines.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {travelerLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            {rooms.length > 0 ? (
              <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                  Kamertype
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {rooms.length} {rooms.length === 1 ? 'type' : 'types'} uit de catalogusgegevens van deze reis.
                </p>
                <div className="mt-5 grid gap-3">
                  {rooms.map((room) => {
                    const selected = selectedRoom?.id === room.id;
                    const href = buildOfferDetailHref(offer.id, {
                      ...params,
                      selectedRoom: room.id,
                    });
                    return (
                      <Link
                        key={room.id}
                        href={href}
                        scroll={false}
                        aria-current={selected ? 'true' : undefined}
                        className={`block rounded-3xl border px-5 py-4 transition ${
                          selected
                            ? 'border-brand-600 bg-brand-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="break-words text-base font-semibold text-slate-950">{room.name}</p>
                            {room.code ? (
                              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                Code {room.code}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {room.included ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                Inbegrepen
                              </span>
                            ) : null}
                            {selected ? (
                              <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                                Geselecteerd
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {room.area ? (
                          <p className="mt-2 text-sm text-slate-600">{room.area}</p>
                        ) : null}
                        {room.included && presentable ? (
                          <p className="mt-3 text-sm font-semibold text-slate-900">
                            € {formatPriceNl(offer.price, 2)} p.p.
                          </p>
                        ) : null}
                        {!room.included ? (
                          <p className="mt-3 text-sm text-slate-500">Niet live geprijsd</p>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>

                {selectedRoom ? (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h3 className="text-lg font-semibold text-slate-950">{selectedRoom.name}</h3>
                    {selectedRoom.images.length > 0 ? (
                      <OfferImageGallery
                        images={selectedRoom.images}
                        alt={selectedRoom.name}
                      />
                    ) : null}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <RoomFact label="Kamercode" value={selectedRoom.code} />
                      <RoomFact label="Oppervlakte" value={selectedRoom.area} />
                      <RoomFact label="Slaapkamers" value={selectedRoom.bedrooms} />
                      <RoomFact label="Bedden" value={selectedRoom.bedConfig} />
                      <RoomFact label="Airconditioning" value={selectedRoom.airConditioning} />
                      <RoomFact label="Balkon / terras" value={selectedRoom.balcony} />
                      <RoomFact label="Zeezicht" value={selectedRoom.seaView} />
                      <RoomFact label="Zwembad" value={selectedRoom.pool} />
                      <RoomFact label="Badkamer" value={selectedRoom.bathroom} />
                      <RoomFact label="Minibar" value={selectedRoom.minibar} />
                      <RoomFact label="Kluis" value={selectedRoom.safe} />
                      <RoomFact label="Wifi" value={selectedRoom.wifi} />
                    </div>
                    {selectedRoom.facilities.length > 0 ? (
                      <ul className="mt-4 space-y-2 text-sm text-slate-700">
                        {selectedRoom.facilities.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {(shortDescription || intro || sections.length > 0 || themes.length > 0 || isLastMinute) && (
              <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                  Accommodatie
                </h2>
                {isLastMinute || themes.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {isLastMinute ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                        Last minute
                      </span>
                    ) : null}
                    {themes.map((theme) => (
                      <span key={theme} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {theme}
                      </span>
                    ))}
                  </div>
                ) : null}
                {shortDescription ? (
                  <p className="mt-4 break-words text-base leading-7 text-slate-700">{shortDescription}</p>
                ) : null}
                {intro ? (
                  <p className="mt-4 break-words text-base leading-7 text-slate-600">{intro}</p>
                ) : null}
                {sections.map((section) => (
                  <CatalogSectionBlock key={section.title} section={section} />
                ))}
              </section>
            )}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                Prijs
              </p>
              {occupancySummary ? (
                <p className="mt-3 text-sm text-slate-500">{occupancySummary}</p>
              ) : null}
              {selectedRoom ? (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {selectedRoom.name}
                  {selectedRoom.included ? ' • inbegrepen' : ''}
                </p>
              ) : null}

              {presentable && priceKind === 'amount' ? (
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-4xl font-semibold text-slate-950">
                      €&nbsp;{formatPriceNl(offer.price, 2)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-500">p.p.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Prijs per dag</p>
                    <p className="text-2xl font-semibold text-brand-700">
                      €&nbsp;{formatPriceNl(offer.pricePerDay, 2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">p.p. / dag</p>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-base font-medium text-slate-600">
                  {priceKind === 'unpriced'
                    ? RESULTS_PRICE_COPY.unpriced
                    : RESULTS_PRICE_COPY.unavailable}
                </p>
              )}

              {hasRating ? (
                <p className="mt-4 text-sm text-slate-500">Beoordeling {offer.rating}</p>
              ) : null}

              {bookHref && presentable && priceKind === 'amount' ? (
                <a
                  href={bookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex w-full justify-center rounded-full bg-brand-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-brand-700"
                >
                  Boek bij {offer.provider}
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
