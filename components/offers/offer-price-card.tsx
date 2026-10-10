import {
  cancellationLabel,
  flightLegSummary,
  formatDetailEuro,
  journeyRouteLabel,
  partyTotalHeading,
  presentFlightLegs,
  priceInclusionRows,
  pricePerPersonLine,
  provenDiscountPercentage,
  provenListPrice,
  type DetailOfferExtras,
  type FlightLeg,
} from '@/lib/offers/detail-extras';
import { DETAIL_LIVE_PRICE_CAPTION, detailBookCtaLabel } from '@/lib/offers/offer-detail-view';
import { RESULTS_PRICE_COPY, type ResultsPricePresentationKind } from '@/lib/search/presentable-price';

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function PlaneIcon({ inbound = false }: { inbound?: boolean }) {
  return (
    <span
      className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#eef2f8] text-sm text-vw-navy ${
        inbound ? '-scale-x-100' : ''
      }`}
      aria-hidden
    >
      ✈
    </span>
  );
}

function JourneyLeg({
  title,
  route,
  detail,
  inbound = false,
}: {
  title: string;
  route?: string;
  detail?: string;
  inbound?: boolean;
}) {
  if (!title && !route && !detail) {
    return null;
  }
  return (
    <div className="flex gap-3 py-2">
      <PlaneIcon inbound={inbound} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-vw-navy">{title}</p>
        {route ? <p className="text-[13px] text-[#334155]">{route}</p> : null}
        {detail ? <p className="text-xs text-vw-muted">{detail}</p> : null}
      </div>
    </div>
  );
}

function legFor(extras: DetailOfferExtras, direction: FlightLeg['direction']): FlightLeg | undefined {
  return presentFlightLegs(extras).find((leg) => leg.direction === direction);
}

export function OfferPriceCard({
  provider,
  presentable,
  priceKind,
  extras,
  bookHref,
  roomPriceNote,
  pricedRoomCaption,
}: {
  provider: string;
  presentable: boolean;
  priceKind: ResultsPricePresentationKind;
  extras: DetailOfferExtras;
  bookHref?: string;
  /** Shown when the selected room has no party total of its own. */
  roomPriceNote?: string;
  /** The shown total belongs to the catalog room, not a visitor-chosen unit. */
  pricedRoomCaption?: boolean;
}) {
  const showAmount = presentable && priceKind === 'amount' && Boolean(extras.liveTotalPrice);
  const total = showAmount ? extras.liveTotalPrice : undefined;
  const perPerson = showAmount ? pricePerPersonLine(extras) : undefined;
  const listPrice = showAmount ? provenListPrice(extras) : undefined;
  const discount = showAmount ? provenDiscountPercentage(extras) : undefined;
  const rows = showAmount ? priceInclusionRows(extras) : [];
  const bookLabel = detailBookCtaLabel(provider);
  const canBook = Boolean(bookHref && (showAmount || roomPriceNote));
  const outbound = legFor(extras, 'outbound');
  const inbound = legFor(extras, 'inbound');
  const outboundTitle = extras.departureDateLabel
    ? `Heenreis · ${extras.departureDateLabel}`
    : extras.departureDateIso
      ? 'Heenreis'
      : undefined;
  const returnTitle = extras.returnDateLabel ? `Terugreis · ${extras.returnDateLabel}` : undefined;
  const cancel = cancellationLabel(extras);

  return (
    <div
      className="rounded-[22px] border border-vw-line bg-vw-card p-6 shadow-[0_14px_40px_rgba(10,45,98,0.10)]"
      data-testid="detail-price-card"
    >
      {total ? (
        <p className="text-xs font-semibold text-vw-muted">{partyTotalHeading(extras.partyLabel)}</p>
      ) : null}

      {total ? (
        <>
          {listPrice ? (
            <p className="mt-2 text-[13px] text-vw-muted" data-testid="detail-list-price">
              <span className="line-through">{formatDetailEuro(listPrice.amount)}</span>
              {typeof discount === 'number' ? (
                <span className="ml-2 font-semibold text-vw-green">−{discount}%</span>
              ) : null}
            </p>
          ) : null}
          <p
            className="mt-1 font-vw-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-vw-navy min-[901px]:text-[46px]"
            data-testid="detail-total"
          >
            {formatDetailEuro(total.amount)}
          </p>
          {perPerson ? (
            <p className="mt-2.5 text-[13px] text-vw-muted" data-testid="detail-pp">
              {perPerson}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-vw-green">✓ {DETAIL_LIVE_PRICE_CAPTION}</p>
        </>
      ) : roomPriceNote ? (
        <p className="mt-4 text-base font-medium text-[#334155]" data-testid="detail-room-price-note">
          {roomPriceNote}
        </p>
      ) : (
        <p className="mt-4 text-base font-medium text-[#334155]" data-testid="detail-price-fallback">
          {priceKind === 'unpriced' ? RESULTS_PRICE_COPY.unpriced : RESULTS_PRICE_COPY.unavailable}
        </p>
      )}

      {canBook ? (
        <a
          href={bookHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="detail-book"
          className="mt-[18px] flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] bg-vw-navy px-4 text-base font-semibold text-white shadow-[0_8px_20px_rgba(10,45,98,0.25)] transition hover:bg-vw-navy-hover"
        >
          {bookLabel}
          <ExternalIcon />
        </a>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-[18px] border-t border-[#eee7da] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7a5c]">Wat zit in de prijs</p>
          <ul className="mt-2">
            {rows.map((row) => (
              <li key={`${row.label}-${row.value}`} className="flex items-baseline justify-between gap-3 py-1.5 text-[13.5px] text-[#334155]">
                <span>{row.label}</span>
                <b className={`whitespace-nowrap font-semibold ${row.tone === 'included' ? 'text-vw-green' : 'text-vw-navy'}`}>
                  {row.value}
                </b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outboundTitle || returnTitle || extras.durationLabel || extras.partyWithRoomsLabel || extras.roomTypeLabel || cancel ? (
        <div className="mt-4 border-t border-[#eee7da] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7a5c]">Jouw reis</p>
          {outboundTitle ? (
            <JourneyLeg
              title={outboundTitle}
              route={journeyRouteLabel(extras, 'outbound')}
              detail={outbound ? flightLegSummary(outbound) : undefined}
            />
          ) : null}
          {returnTitle ? (
            <JourneyLeg
              title={returnTitle}
              route={journeyRouteLabel(extras, 'inbound')}
              detail={inbound ? flightLegSummary(inbound) : undefined}
              inbound
            />
          ) : null}
          <ul className="mt-1 overflow-hidden rounded-[14px] border border-[#ece5d8]">
            {extras.durationLabel ? (
              <li className="flex justify-between gap-3 border-t border-[#ece5d8] bg-white px-3.5 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-vw-muted">Reisduur</span>
                <b className="text-right font-semibold text-vw-navy">{extras.durationLabel}</b>
              </li>
            ) : null}
            {extras.partyWithRoomsLabel ? (
              <li className="flex justify-between gap-3 border-t border-[#ece5d8] bg-white px-3.5 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-vw-muted">Reizigers</span>
                <b className="text-right font-semibold text-vw-navy">{extras.partyWithRoomsLabel}</b>
              </li>
            ) : null}
            {extras.roomTypeLabel ? (
              <li className="flex justify-between gap-3 border-t border-[#ece5d8] bg-white px-3.5 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-vw-muted">Kamer</span>
                <b className="text-right font-semibold text-vw-navy">
                  {extras.roomTypeLabel}
                  {pricedRoomCaption ? (
                    <span className="mt-0.5 block text-[11px] font-semibold text-vw-green">
                      Prijs gebaseerd op deze kamer
                    </span>
                  ) : null}
                </b>
              </li>
            ) : null}
            {extras.boardType ? (
              <li className="flex justify-between gap-3 border-t border-[#ece5d8] bg-white px-3.5 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-vw-muted">Verzorging</span>
                <b className="text-right font-semibold text-vw-navy">{extras.boardType}</b>
              </li>
            ) : null}
            {cancel ? (
              <li className="flex justify-between gap-3 border-t border-[#ece5d8] bg-white px-3.5 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-vw-muted">Annuleren</span>
                <b className="text-right font-semibold text-vw-navy">{cancel}</b>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function OfferDetailMobileBar({
  provider,
  presentable,
  priceKind,
  extras,
  bookHref,
  roomPriceNote,
}: {
  provider: string;
  presentable: boolean;
  priceKind: ResultsPricePresentationKind;
  extras: DetailOfferExtras;
  bookHref?: string;
  /** Shown instead of the party total when the selected room has no price of its own. */
  roomPriceNote?: string;
}) {
  const showAmount = presentable && priceKind === 'amount' && Boolean(extras.liveTotalPrice);
  const canBook = Boolean(bookHref && ((showAmount && extras.liveTotalPrice) || roomPriceNote));
  if (!canBook || !bookHref) {
    return null;
  }
  const perPerson = showAmount ? pricePerPersonLine(extras) : undefined;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-vw-line bg-[rgba(255,253,249,0.96)] px-4 py-2.5 shadow-[0_-8px_24px_rgba(10,20,40,0.10)] backdrop-blur min-[901px]:hidden"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      data-testid="detail-book-bar"
    >
      <div className="min-w-0 flex-1">
        {showAmount && extras.liveTotalPrice ? (
          <>
            <span className="block text-[11px] text-vw-muted">{partyTotalHeading(extras.partyLabel)}</span>
            <b className="block whitespace-nowrap font-vw-serif text-[22px] font-semibold leading-none text-vw-navy">
              {formatDetailEuro(extras.liveTotalPrice.amount)}
            </b>
            {perPerson ? <span className="mt-0.5 block truncate text-[11.5px] text-vw-muted">{perPerson}</span> : null}
          </>
        ) : (
          <span className="block text-[13px] font-medium leading-snug text-[#334155]" data-testid="detail-book-bar-note">
            {roomPriceNote}
          </span>
        )}
      </div>
      <a
        href={bookHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 shrink-0 items-center rounded-xl bg-vw-navy px-3.5 text-[13.5px] font-semibold text-white"
      >
        {detailBookCtaLabel(provider)}
      </a>
    </div>
  );
}
