import Link from 'next/link';
import { OfferImageGallery } from '@/components/offers/offer-image-gallery';
import { OfferDetailMobileBar, OfferPriceCard } from '@/components/offers/offer-price-card';
import {
  DetailAdjustMobile,
  DetailAdjustPrice,
  DetailAdjustProvider,
  DetailAdjustRooms,
  DetailPartySummary,
} from '@/components/offers/offer-trip-adjust';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import type { CatalogRoomType, CatalogSection } from '@/lib/offers/catalog-content';
import {
  buildDetailOfferExtras,
  formatDetailEuro,
  hasRentalCarDetails,
  hasStructuredDayProgramme,
  type DetailOfferExtras,
} from '@/lib/offers/detail-extras';
import { displayHotelName } from '@/lib/offers/display-hotel-name';
import { CAR_RENTAL_INCLUDED_LABEL } from '@/lib/offers/has-car-rental';
import {
  affiliateHref,
  formatAdditionalAirport,
  formatDepartureAirport,
  formatDestination,
  formatFlightIncluded,
  formatDetailAccommodation,
  formatOccupancySummary,
  formatTravelerLines,
  providerTextBlocks,
} from '@/lib/offers/offer-detail-view';
import { formatDeparturePresentation } from '@/lib/search/departure-presentation';
import { formatOccupancyCompositionNl } from '@/lib/search/occupancy-category';
import { buildOfferDetailHref } from '@/lib/search/pagination';
import { modelFromParty, type TravelerModel } from '@/lib/search/traveler-contract';
import type { DetailRoomQuote } from '@/lib/providers/sunweb/room-selector';
import { selectDetailRoomQuote } from '@/lib/providers/sunweb/room-selector';
import {
  buildSunwebOccupancyClickOutHref,
  withSunwebDepartureDate,
  withSunwebRoomType,
} from '@/lib/providers/sunweb/offer-context';
import { DETAIL_SUNWEB_ROOM_QUOTES_ENABLED } from '@/lib/providers/sunweb/room-selector';
import { resultsPricePresentation } from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';

function ratingLabel(rating: number): string {
  if (rating >= 9) return 'Fantastisch';
  if (rating >= 8) return 'Uitstekend';
  if (rating >= 7) return 'Zeer goed';
  return 'Goed';
}

function RoomFact({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="rounded-xl bg-vw-usp px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8a93a3]">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-vw-ink">{value}</p>
    </div>
  );
}

function Fact({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-xl bg-vw-usp px-3.5 py-2.5" data-testid={testId}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#8a93a3]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-vw-navy">{value}</dd>
    </div>
  );
}

function ProviderParagraphs({
  blocks,
  className,
}: {
  blocks: string[];
  className: string;
}) {
  if (blocks.length === 0) {
    return null;
  }
  return blocks.map((block, index) => (
    <p key={`${index}-${block.slice(0, 24)}`} className={className}>
      {block}
    </p>
  ));
}

function CatalogSectionBlock({ section }: { section: CatalogSection }) {
  const items = section.items.flatMap((item) => providerTextBlocks(item));
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="mt-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-vw-navy">{section.title}</h3>
      <ul className="mt-1.5">
        {items.map((item, index) => (
          <li
            key={`${section.title}-${index}-${item}`}
            className="relative py-0.5 pl-4 text-[13.5px] text-[#475569] before:absolute before:left-0.5 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-vw-gold"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function sectionClassName(): string {
  return 'mt-6 rounded-[20px] border border-vw-line bg-vw-card p-5 shadow-vw-panel min-[901px]:p-7';
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
  extras: extrasOverride,
  galleryNote,
  roomHref,
  roomQuotes,
  compositionFailed,
  tripDate,
  adjustPath,
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
  /** Test hook. Production builds extras from the offer. */
  extras?: DetailOfferExtras;
  /** Lab-only caption under the gallery. Omitted on the live detail page. */
  galleryNote?: string;
  /** Lab-only room links. The live page keeps the offer detail URL. */
  roomHref?: (roomId: string) => string;
  /** Sunweb GetRoomSelectorApi rooms for this party. Null when that call was not made. */
  roomQuotes?: DetailRoomQuote[] | null;
  /** The provider returned no total for the party on this page. */
  compositionFailed?: boolean;
  /** Visitor departure date. Sunweb reprices this; other providers ignore it. */
  tripDate?: string;
  /** Lab pages pass their own path. The live page uses the offer URL. */
  adjustPath?: string;
}) {
  const roomChoiceEnabled = DETAIL_SUNWEB_ROOM_QUOTES_ENABLED;
  const visitorDate = roomChoiceEnabled && tripDate && /^\d{4}-\d{2}-\d{2}$/.test(tripDate) ? tripDate : undefined;
  const datedOffer = visitorDate && visitorDate !== offer.departureDate
    ? { ...offer, departureDate: visitorDate }
    : offer;
  const pricedRoom = rooms.find((room) => room.included) ?? (selectedRoom?.included ? selectedRoom : null);
  const extras = extrasOverride ?? buildDetailOfferExtras(datedOffer, params, {
    roomTypeLabel: roomChoiceEnabled ? selectedRoom?.name : pricedRoom?.name,
  });
  const occupancySummary = formatOccupancySummary(params);
  const travelerLines = formatTravelerLines(params);
  const quotes = roomChoiceEnabled ? (roomQuotes ?? []) : [];
  const selectedQuote = quotes.length > 0
    ? selectDetailRoomQuote(quotes, params.selectedRoom ?? selectedRoom?.id)
    : null;
  const quoteTotal = selectedQuote?.totalPrice;
  let bookHref = affiliateHref(offer, params);
  if (offer.provider === 'Sunweb' && bookHref) {
    bookHref = buildSunwebOccupancyClickOutHref(offer, params) ?? bookHref;
    if (tripDate && tripDate !== offer.departureDate) {
      bookHref = withSunwebDepartureDate(bookHref, tripDate) ?? bookHref;
    }
    if (selectedQuote) {
      bookHref = withSunwebRoomType(bookHref, selectedQuote.id) ?? bookHref;
    }
  }
  const priceKind = resultsPricePresentation(offer);
  const destination = formatDestination(offer);
  const hasStars = typeof offer.stars === 'number' && offer.stars > 0;
  const hasRating = typeof offer.rating === 'number' && Number.isFinite(offer.rating);
  const shortBlocks = providerTextBlocks(offer.descriptionShort);
  const introBlocks = providerTextBlocks(intro);
  const visibleSections = sections.filter((section) =>
    section.items.some((item) => providerTextBlocks(item).length > 0),
  );
  const departureAirportLabel = formatDepartureAirport(offer);
  const additionalAirport = formatAdditionalAirport(offer);
  const departurePhrase = formatDeparturePresentation(params, datedOffer.departureDate).phrase;
  const flightIncludedLabel = formatFlightIncluded(offer.flightIncluded);
  const quoteReplacesCatalogTotal =
    typeof quoteTotal === 'number' && quoteTotal !== extras.liveTotalPrice?.amount;
  const pricedExtras = {
    ...extras,
    ...(selectedQuote ? { roomTypeLabel: selectedQuote.name } : {}),
    ...(typeof quoteTotal === 'number'
      ? {
          liveTotalPrice: { amount: quoteTotal, currency: extras.liveTotalPrice?.currency ?? 'EUR' },
          liveTotalPriceField: 'GetRoomSelectorApi.totalPrice',
          // The feed p.p. line and strike-through belong to the original total.
          ...(quoteReplacesCatalogTotal
            ? { livePricePerPerson: undefined, listPrice: undefined, discountPercentage: undefined }
            : {}),
        }
      : {}),
  };
  const blockCatalogPrice = Boolean(compositionFailed) || (Boolean(tripDate) && tripDate !== offer.departureDate && typeof quoteTotal !== 'number');
  const displayPresentable = typeof quoteTotal === 'number' ? true : presentable && !blockCatalogPrice;
  const displayPriceKind = typeof quoteTotal === 'number' ? 'amount' as const : priceKind;
  const showAmount = displayPresentable && displayPriceKind === 'amount' && Boolean(pricedExtras.liveTotalPrice);
  const partyTotal = typeof quoteTotal === 'number'
    ? { amount: quoteTotal, currency: 'EUR' as const }
    : priceKind === 'amount' && !blockCatalogPrice
      ? extras.liveTotalPrice
      : undefined;
  const roomPriceNote = roomChoiceEnabled
    ? selectedQuote && typeof selectedQuote.totalPrice !== 'number'
      ? `Prijs voor deze kamer zie je bij ${offer.provider}`
      : selectedRoom && !selectedRoom.included && quotes.length === 0
        ? `Prijs voor deze kamer zie je bij ${offer.provider}`
        : undefined
    : undefined;
  const accommodationLine = formatDetailAccommodation(offer.accommodationType, offer.accommodation);
  const canBook = Boolean(bookHref && (showAmount || roomPriceNote));

  const facts = [
    departurePhrase ? { label: 'Vertrekdatum', value: departurePhrase } : undefined,
    extras.returnDateLabel
      ? { label: 'Terugreis', value: extras.returnDateLabel, testId: 'detail-return-date' }
      : undefined,
    departureAirportLabel ? { label: 'Vertrekluchthaven', value: departureAirportLabel } : undefined,
    extras.arrivalAirport ? { label: 'Aankomstluchthaven', value: extras.arrivalAirport } : undefined,
    additionalAirport ? { label: 'Luchthaven', value: additionalAirport } : undefined,
    extras.durationLabel ? { label: 'Duur', value: extras.durationLabel } : undefined,
    extras.boardType ? { label: 'Verzorging', value: extras.boardType } : undefined,
    accommodationLine ? { label: 'Accommodatie', value: accommodationLine } : undefined,
    flightIncludedLabel ? { label: 'Vlucht', value: flightIncludedLabel } : undefined,
  ].filter((fact): fact is { label: string; value: string; testId?: string } => Boolean(fact));

  const traveler: TravelerModel = params.party && params.party.length > 0
    ? modelFromParty(params.party, params.rooms)
    : {
        adults: params.adults && params.adults > 0 ? params.adults : 2,
        childAges: params.childAges ?? [],
        roomCount: (params.rooms ?? 1) > 1 ? 2 : 1,
        roomAssignments: Array.from(
          { length: (params.adults && params.adults > 0 ? params.adults : 2) + (params.childAges?.length ?? 0) },
          () => 0,
        ),
      };
  const preservedQuery = (() => {
    const href = buildOfferDetailHref(offer.id, params);
    const url = new URL(href, 'https://vacationweb.local');
    for (const key of ['adults', 'childAges', 'children', 'babies', 'rooms', 'partyRooms', 'dob', 'room', 'tripDate']) {
      url.searchParams.delete(key);
    }
    return url.searchParams.toString();
  })();
  const partyLine = formatOccupancyCompositionNl(params, {
    includeRooms: traveler.roomCount > 1,
    joiner: ', ',
  });

  return (
    <main className="min-h-screen bg-vw-bg font-vw-sans text-vw-ink">
      <DetailAdjustProvider
        pagePath={adjustPath ?? `/offers/${encodeURIComponent(offer.id)}`}
        preservedQuery={preservedQuery}
        initial={traveler}
      >
      <ResultsSiteHeader appearance="results" />

      <div
        className={`mx-auto min-w-0 max-w-vw-page overflow-x-clip px-4 pt-3 min-[901px]:px-7 min-[901px]:pt-2 ${
          canBook ? 'pb-28 min-[901px]:pb-16' : 'pb-10'
        }`}
      >
        <Link href={resultsHref} className="text-sm font-semibold text-vw-navy">
          ← Terug naar resultaten
        </Link>

        <OfferImageGallery images={galleryImages} alt={displayHotelName(offer)} />
        {galleryNote ? <p className="mt-2 text-[11.5px] text-[#a39a8c]">{galleryNote}</p> : null}

        <div className="mt-6 grid min-w-0 gap-0 min-[901px]:grid-cols-[minmax(0,1fr)_380px] min-[901px]:items-start min-[901px]:gap-x-11">
          <header className="min-w-0 min-[901px]:col-start-1 min-[901px]:row-start-1">
            <p className="text-[13px] font-semibold tracking-wide text-[#8a7a5c]">{offer.provider}</p>
            <h1 className="mt-1 break-words font-vw-serif text-[29px] font-medium leading-[1.1] tracking-[-0.015em] text-vw-navy min-[901px]:text-[40px]">
              {displayHotelName(offer)}
              {extras.tripBadge ? (
                <span
                  data-testid="detail-trip-badge"
                  className="ml-2.5 inline-block align-middle rounded-full bg-vw-navy px-2.5 py-0.5 font-vw-sans text-[11.5px] font-semibold tracking-wide text-white"
                >
                  {extras.tripBadge}
                </span>
              ) : null}
            </h1>
            {hasStars || destination || hasRating ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-vw-muted">
                {hasStars ? (
                  <span>
                    <span className="tracking-[1px] text-vw-gold" aria-hidden>
                      {'★'.repeat(offer.stars ?? 0)}
                    </span>{' '}
                    {offer.stars} sterren
                  </span>
                ) : null}
                {destination ? <span>{destination}</span> : null}
                {hasRating ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="detail-rating">
                    <span className="rounded-md bg-vw-green px-1.5 py-0.5 text-sm font-bold text-white">
                      {String(offer.rating).replace('.', ',')}
                    </span>
                    <span className="text-[13px] font-semibold text-vw-green">
                      {ratingLabel(offer.rating as number)}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
            {isLastMinute || themes.length > 0 || extras.carRentalIncluded ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {isLastMinute ? (
                  <span className="inline-flex h-[30px] items-center rounded-full border border-[#f5d68f] bg-[#fdecc8] px-3 text-[12.5px] font-semibold text-[#8a5a00]">
                    Last minute
                  </span>
                ) : null}
                {extras.carRentalIncluded ? (
                  <span className="inline-flex h-[30px] items-center rounded-full border border-vw-line bg-white px-3 text-[12.5px] text-[#334155]">
                    {CAR_RENTAL_INCLUDED_LABEL}
                  </span>
                ) : null}
                {themes.map((theme) => (
                  <span
                    key={theme}
                    className="inline-flex h-[30px] items-center rounded-full border border-vw-line bg-white px-3 text-[12.5px] text-[#334155]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          {/* mt-28 keeps the in-flow card below the mobile sticky bar on the first screen. Desktop margin is reset. */}
          <aside className="mt-28 min-w-0 min-[901px]:sticky min-[901px]:top-5 min-[901px]:col-start-2 min-[901px]:row-span-2 min-[901px]:row-start-1 min-[901px]:mt-0 min-[901px]:max-h-[calc(100vh-2.5rem)] min-[901px]:self-start min-[901px]:overflow-auto">
            <DetailAdjustPrice>
              <OfferPriceCard
                provider={offer.provider}
                presentable={displayPresentable}
                priceKind={displayPriceKind}
                extras={pricedExtras}
                bookHref={bookHref}
                roomPriceNote={roomPriceNote}
                pricedRoomCaption={Boolean(partyTotal && (selectedQuote || selectedRoom?.included))}
                compositionFailed={compositionFailed && typeof quoteTotal !== 'number' && !roomPriceNote}
              />
            </DetailAdjustPrice>
          </aside>

          <div className="min-w-0 min-[901px]:col-start-1 min-[901px]:row-start-2">
            {facts.length > 0 || occupancySummary || travelerLines.length > 0 ? (
              <section className={sectionClassName()}>
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Reis</h2>
                {facts.length > 0 ? (
                  <dl className="mt-4 grid gap-2.5 sm:grid-cols-2 min-[1100px]:grid-cols-3">
                    {facts.map((fact) => (
                      <Fact key={fact.label} label={fact.label} value={fact.value} testId={fact.testId} />
                    ))}
                  </dl>
                ) : null}
                {occupancySummary ? (
                  <p className="mt-4 text-sm font-semibold text-vw-ink">{occupancySummary}</p>
                ) : null}
                {travelerLines.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-[13.5px] text-vw-muted">
                    {travelerLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {hasStructuredDayProgramme(extras) && extras.dayProgramme ? (
              <section className={sectionClassName()} data-testid="detail-day-programme">
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Dagprogramma</h2>
                <ol className="mt-4 space-y-4">
                  {extras.dayProgramme.map((stop) => (
                    <li key={`${stop.day}-${stop.title}`}>
                      <p className="font-vw-serif text-lg text-vw-navy">
                        Dag {stop.day}
                        {stop.title ? ` · ${stop.title}` : ''}
                      </p>
                      {stop.note ? <p className="mt-1 text-sm leading-6 text-[#475569]">{stop.note}</p> : null}
                      {stop.overnight ? (
                        <p className="mt-1 text-[12.5px] text-[#334155]">Overnachting: {stop.overnight}</p>
                      ) : null}
                      {typeof stop.distanceKm === 'number' ? (
                        <p className="text-[12.5px] text-vw-muted">{stop.distanceKm} km</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {hasRentalCarDetails(extras) && extras.rentalCar ? (
              <section className={sectionClassName()} data-testid="detail-rental-car">
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Huurauto</h2>
                <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {extras.rentalCar.category ? (
                    <Fact label="Categorie" value={extras.rentalCar.category} />
                  ) : null}
                  {extras.rentalCar.exampleType ? (
                    <Fact label="Voorbeeldtype" value={extras.rentalCar.exampleType} />
                  ) : null}
                  {extras.rentalCar.pickup ? (
                    <Fact label="Ophalen" value={extras.rentalCar.pickup} />
                  ) : null}
                  {extras.rentalCar.dropoff ? (
                    <Fact label="Inleveren" value={extras.rentalCar.dropoff} />
                  ) : null}
                </dl>
              </section>
            ) : null}

            <DetailPartySummary label={partyLine || '2 volwassenen'} />

            {roomChoiceEnabled && quotes.length > 0 ? (
              <DetailAdjustRooms
                rooms={quotes}
                selectedId={selectedQuote?.id}
                provider={offer.provider}
              />
            ) : roomChoiceEnabled && rooms.length > 0 ? (
              <section className={sectionClassName()} data-testid="detail-room-choice">
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Kies je kamer</h2>
                <div className="mt-4 grid gap-2.5">
                  {rooms.map((room) => {
                    const selected = selectedRoom?.id === room.id;
                    const href = roomHref
                      ? roomHref(room.id)
                      : buildOfferDetailHref(offer.id, {
                          ...params,
                          selectedRoom: room.id,
                        });
                    const priced = Boolean(room.included && partyTotal);
                    return (
                      <Link
                        key={room.id}
                        href={href}
                        scroll={false}
                        aria-current={selected ? 'true' : undefined}
                        data-testid={priced ? 'detail-room-priced' : 'detail-room-unpriced'}
                        className={`block rounded-2xl border px-4 py-3.5 ${
                          selected
                            ? 'border-vw-navy bg-[#f1f4fa] shadow-[inset_0_0_0_1px_var(--vw-navy)]'
                            : 'border-[#e3dccf] bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="break-words text-[15px] font-semibold text-vw-navy">{room.name}</p>
                            {room.code ? (
                              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#98a1b2]">
                                Code {room.code}
                              </p>
                            ) : null}
                            {room.bedrooms ? (
                              <p className="mt-0.5 text-[13px] text-vw-muted">{room.bedrooms}</p>
                            ) : null}
                          </div>
                          {selected ? (
                            <span className="rounded-full bg-vw-navy px-2.5 py-0.5 text-[11.5px] font-semibold text-white">
                              Geselecteerd
                            </span>
                          ) : null}
                        </div>
                        {room.area ? <p className="mt-1.5 text-[13px] text-vw-muted">{room.area}</p> : null}
                        {priced && partyTotal ? (
                          <p className="mt-2 text-sm text-vw-navy">
                            <span className="font-semibold text-vw-green">Prijs gebaseerd op deze kamer</span>
                            <span className="mt-0.5 block font-bold">
                              Totaal {formatDetailEuro(partyTotal.amount)}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-2 text-[13px] text-[#475569]">
                            Prijs voor deze kamer zie je bij {offer.provider}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {selectedRoom ? (
                  <div className="mt-5 border-t border-[#eee7da] pt-5">
                    <h3 className="font-vw-serif text-lg font-medium text-vw-navy">{selectedRoom.name}</h3>
                    {selectedRoom.images.length > 0 ? (
                      <OfferImageGallery images={selectedRoom.images} alt={selectedRoom.name} />
                    ) : null}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 min-[1100px]:grid-cols-3">
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
                      <ul className="mt-4 columns-1 gap-6 text-[13.5px] text-[#475569] sm:columns-2">
                        {selectedRoom.facilities.flatMap((item) => providerTextBlocks(item)).map((item, index) => (
                          <li key={`${index}-${item}`} className="break-inside-avoid py-0.5">
                            <span className="mr-2 font-bold text-vw-green" aria-hidden>
                              ✓
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : pricedRoom ? (
              <section className={sectionClassName()} data-testid="detail-priced-room">
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">{pricedRoom.name}</h2>
                {pricedRoom.images.length > 0 ? (
                  <OfferImageGallery images={pricedRoom.images} alt={pricedRoom.name} />
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 min-[1100px]:grid-cols-3">
                  <RoomFact label="Kamercode" value={pricedRoom.code} />
                  <RoomFact label="Oppervlakte" value={pricedRoom.area} />
                  <RoomFact label="Slaapkamers" value={pricedRoom.bedrooms} />
                  <RoomFact label="Bedden" value={pricedRoom.bedConfig} />
                  <RoomFact label="Airconditioning" value={pricedRoom.airConditioning} />
                  <RoomFact label="Balkon / terras" value={pricedRoom.balcony} />
                  <RoomFact label="Zeezicht" value={pricedRoom.seaView} />
                  <RoomFact label="Zwembad" value={pricedRoom.pool} />
                  <RoomFact label="Badkamer" value={pricedRoom.bathroom} />
                  <RoomFact label="Minibar" value={pricedRoom.minibar} />
                  <RoomFact label="Kluis" value={pricedRoom.safe} />
                  <RoomFact label="Wifi" value={pricedRoom.wifi} />
                </div>
                {pricedRoom.facilities.length > 0 ? (
                  <ul className="mt-4 columns-1 gap-6 text-[13.5px] text-[#475569] sm:columns-2">
                    {pricedRoom.facilities.flatMap((item) => providerTextBlocks(item)).map((item, index) => (
                      <li key={`${index}-${item}`} className="break-inside-avoid py-0.5">
                        <span className="mr-2 font-bold text-vw-green" aria-hidden>
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {(shortBlocks.length > 0 || introBlocks.length > 0 || visibleSections.length > 0) && (
              <section className={sectionClassName()} data-testid="detail-accommodation-copy">
                <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Accommodatie</h2>
                <ProviderParagraphs
                  blocks={shortBlocks}
                  className="mt-3 break-words text-[15.5px] leading-7 text-[#334155]"
                />
                <ProviderParagraphs
                  blocks={introBlocks}
                  className="mt-2.5 break-words text-[15px] leading-7 text-vw-muted"
                />
                {visibleSections.length > 0 ? (
                  <div className="mt-5 grid gap-x-7 sm:grid-cols-2">
                    {visibleSections.map((section) => (
                      <CatalogSectionBlock key={section.title} section={section} />
                    ))}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        </div>
      </div>

      <DetailAdjustMobile>
        <OfferDetailMobileBar
          provider={offer.provider}
          presentable={displayPresentable}
          priceKind={displayPriceKind}
          extras={pricedExtras}
          bookHref={bookHref}
          roomPriceNote={roomPriceNote}
          compositionFailed={compositionFailed && typeof quoteTotal !== 'number' && !roomPriceNote}
        />
      </DetailAdjustMobile>
      </DetailAdjustProvider>
    </main>
  );
}
