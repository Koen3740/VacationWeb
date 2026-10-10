/**
 * Provider-independent detail extras.
 *
 * The detail page renders a row only when the matching field is present.
 * Absent fields stay out of the HTML (no "onbekend", no empty slot).
 *
 * Kern fields are filled from the offer we already have. Optional blocks
 * (flights, baggage, transfer, list price, fees, guarantee fund, rental-car
 * details, day programme) stay empty until a parser retains them.
 * This module does not call providers.
 *
 * Not wired in this build (already in some live JSON, not retained):
 * - Sunweb/Eliza GetPromotedPrice `price.originalTotalPrice` and
 *   `price.discountPercentage` — `readPromotedPrice` keeps only average/total.
 *   No new request parameters are required; retaining them is a live-price change.
 * - Corendon upsales flight times, airline, flight number, baggage weight,
 *   transfer and discount lines — the upsales client keeps only total and p.p.
 */

import { isProvenFlyAndDriveRondreis } from '@/lib/offers/fly-drive-rondreis';
import { offerHasCarRental } from '@/lib/offers/has-car-rental';
import { catalogReturnDateIso } from '@/lib/offers/duration-semantics';
import {
  formatDepartureAirport,
  formatFlightIncluded,
  formatNightsLabel,
  formatOfferReturnDateLabel,
  formatPriceNl,
  formatTripDateNl,
  looksLikeTechnicalDisplayText,
} from '@/lib/offers/offer-detail-view';
import { boardTypeLabelForDutchUi } from '@/lib/offers/ui-locale';
import { normalizeDepartureDateToIso } from '@/lib/search/departure-date';
import { formatOccupancySummaryParts } from '@/lib/search/occupancy-category';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type DetailMoney = {
  amount: number;
  currency: 'EUR';
  label?: string;
};

export type FlightLeg = {
  direction: 'outbound' | 'inbound';
  departureAirportCode?: string;
  arrivalAirportCode?: string;
  /** ISO or a provider-local time string. Shown only when set. */
  departureAt?: string;
  arrivalAt?: string;
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  baggage?: {
    checkedWeightKg?: number;
    policyNote?: string;
  };
};

export type DayStop = {
  day: number;
  title: string;
  overnight?: string;
  distanceKm?: number;
  note?: string;
};

export type RentalCarDetails = {
  category?: string;
  exampleType?: string;
  pickup?: string;
  dropoff?: string;
};

/**
 * Optional detail model (DETAIL_DATA_VERIFICATIE §5) plus the two blocks the
 * detail brief adds: a structured day programme and rental-car details.
 * Both extensions stay unset until a provider field actually exists.
 */
export type DetailOfferExtras = {
  liveTotalPrice?: DetailMoney;
  livePricePerPerson?: DetailMoney;
  departureDateIso?: string;
  departureDateLabel?: string;
  returnDateIso?: string;
  returnDateLabel?: string;
  departureAirportLabel?: string;
  departureAirportCode?: string;
  destinationLabel?: string;
  boardType?: string;
  flightIncluded?: boolean;
  roomTypeLabel?: string;
  durationLabel?: string;
  /** "2 volwassenen" — from the search party, never from price ÷ p.p. */
  partyLabel?: string;
  partyWithRoomsLabel?: string;
  arrivalAirport?: string;
  flights?: FlightLeg[];
  transfer?: {
    status: 'included' | 'bookable' | 'not_included' | 'unknown';
    price?: DetailMoney;
    remark?: string;
  };
  cancellation?: {
    freeUntil?: string;
    isRefundable?: boolean;
    insurancePrice?: DetailMoney;
    summary?: string;
  };
  listPrice?: DetailMoney;
  discountPercentage?: number;
  discountLines?: { name: string; amount: DetailMoney }[];
  priceBreakdown?: { name: string; amount: DetailMoney }[];
  adminFees?: DetailMoney;
  guaranteeFund?: { name: string; note?: string };
  /** Proven boolean only. Category and pickup live on `rentalCar`. */
  carRentalIncluded?: boolean;
  rentalCar?: RentalCarDetails;
  dayProgramme?: DayStop[];
  /** Set when the offer is a proven Fly & Drive / roadtrip. */
  tripBadge?: string;
};

export type PriceInclusionRow = {
  label: string;
  value: string;
  tone?: 'included';
};

function money(amount: number, label?: string): DetailMoney | undefined {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  return label ? { amount, currency: 'EUR', label } : { amount, currency: 'EUR' };
}

function joinNl(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  if (items.length === 2) {
    return `${items[0]} en ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function flightIncludedFlag(value: string | undefined): boolean | undefined {
  const label = formatFlightIncluded(value);
  if (label === 'Vlucht inbegrepen') {
    return true;
  }
  if (label === 'Zonder vlucht') {
    return false;
  }
  return undefined;
}

function iataCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^[A-Za-z]{3}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed.toUpperCase();
}

export function formatDetailEuro(amount: number): string {
  return `€\u00a0${formatPriceNl(amount, 2)}`;
}

export function partyTotalHeading(partyLabel: string | undefined): string {
  return partyLabel ? `Totaal voor ${partyLabel}` : 'Totaal';
}

export function hasStructuredDayProgramme(extras: DetailOfferExtras): boolean {
  return (extras.dayProgramme?.length ?? 0) > 0;
}

export function hasRentalCarDetails(extras: DetailOfferExtras): boolean {
  const car = extras.rentalCar;
  if (!car) {
    return false;
  }
  return Boolean(car.category?.trim() || car.exampleType?.trim() || car.pickup?.trim() || car.dropoff?.trim());
}

/** Strike-through only when the provider list total is higher than the current total. */
export function provenListPrice(extras: DetailOfferExtras): DetailMoney | undefined {
  const total = extras.liveTotalPrice?.amount;
  const list = extras.listPrice?.amount;
  if (
    typeof total !== 'number'
    || typeof list !== 'number'
    || !Number.isFinite(total)
    || !Number.isFinite(list)
    || list <= total
  ) {
    return undefined;
  }
  return extras.listPrice;
}

export function provenDiscountPercentage(extras: DetailOfferExtras): number | undefined {
  if (!provenListPrice(extras)) {
    return undefined;
  }
  const value = extras.discountPercentage;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 100) {
    return undefined;
  }
  return Math.round(value);
}

export function pricePerPersonLine(extras: DetailOfferExtras): string | undefined {
  const amount = extras.livePricePerPerson?.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const base = `${formatDetailEuro(amount)} p.p.`;
  const parts: string[] = [];
  if (extras.flightIncluded === true) {
    parts.push('vlucht');
  }
  if (extras.boardType?.trim()) {
    parts.push(lowerFirst(extras.boardType.trim()));
  }
  if (extras.carRentalIncluded) {
    parts.push('huurauto');
  }
  if (parts.length === 0) {
    return base;
  }
  return `${base} · incl. ${joinNl(parts)}`;
}

export function legHasSchedule(leg: FlightLeg): boolean {
  return Boolean(
    leg.departureAt?.trim()
    || leg.arrivalAt?.trim()
    || leg.airlineName?.trim()
    || leg.airlineCode?.trim()
    || leg.flightNumber?.trim()
    || (typeof leg.baggage?.checkedWeightKg === 'number' && leg.baggage.checkedWeightKg > 0)
    || leg.baggage?.policyNote?.trim(),
  );
}

export function presentFlightLegs(extras: DetailOfferExtras): FlightLeg[] {
  return (extras.flights ?? []).filter(legHasSchedule);
}

export function flightLegSummary(leg: FlightLeg): string | undefined {
  const bits: string[] = [];
  const airline = [leg.airlineName?.trim(), leg.flightNumber?.trim()].filter(Boolean).join(' ');
  if (airline) {
    bits.push(airline);
  } else if (leg.airlineCode?.trim()) {
    bits.push(leg.airlineCode.trim());
  }
  const times = [leg.departureAt?.trim(), leg.arrivalAt?.trim()].filter(Boolean).join(' – ');
  if (times) {
    bits.push(times);
  }
  const weight = leg.baggage?.checkedWeightKg;
  if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
    bits.push(`${weight} kg ruimbagage`);
  }
  if (leg.baggage?.policyNote?.trim()) {
    bits.push(leg.baggage.policyNote.trim());
  }
  return bits.length > 0 ? bits.join(' · ') : undefined;
}

export function transferLabel(extras: DetailOfferExtras): string | undefined {
  const transfer = extras.transfer;
  if (!transfer || transfer.status === 'unknown') {
    return undefined;
  }
  if (transfer.status === 'included') {
    return 'Transfer inbegrepen';
  }
  if (transfer.status === 'bookable') {
    return transfer.price ? `Transfer bij te boeken (${formatDetailEuro(transfer.price.amount)})` : 'Transfer bij te boeken';
  }
  if (transfer.status === 'not_included') {
    return 'Transfer niet inbegrepen';
  }
  return undefined;
}

export function cancellationLabel(extras: DetailOfferExtras): string | undefined {
  const cancellation = extras.cancellation;
  if (!cancellation) {
    return undefined;
  }
  if (cancellation.summary?.trim()) {
    return cancellation.summary.trim();
  }
  if (cancellation.freeUntil?.trim()) {
    return `Gratis annuleren tot ${cancellation.freeUntil.trim()}`;
  }
  if (cancellation.isRefundable === true) {
    return 'Annuleren mogelijk';
  }
  return undefined;
}

export function priceInclusionRows(extras: DetailOfferExtras): PriceInclusionRow[] {
  const rows: PriceInclusionRow[] = [];
  const total = extras.liveTotalPrice?.amount;
  if (typeof total === 'number' && total > 0) {
    const stay = extras.flightIncluded === true ? 'Vlucht + verblijf' : 'Verblijf';
    const label = extras.partyLabel ? `${stay}, ${extras.partyLabel}` : stay;
    rows.push({ label, value: formatDetailEuro(total) });
  }
  if (extras.boardType?.trim()) {
    rows.push({ label: extras.boardType.trim(), value: 'inbegrepen', tone: 'included' });
  }
  if (extras.carRentalIncluded) {
    rows.push({ label: 'Huurauto', value: 'inbegrepen', tone: 'included' });
  }
  const discount = provenDiscountPercentage(extras);
  if (typeof discount === 'number') {
    rows.push({ label: 'Korting', value: `−${discount}%` });
  }
  for (const line of extras.discountLines ?? []) {
    const name = line.name?.trim();
    if (!name || !money(Math.abs(line.amount.amount))) {
      continue;
    }
    rows.push({ label: name, value: formatDetailEuro(Math.abs(line.amount.amount)) });
  }
  for (const line of extras.priceBreakdown ?? []) {
    const name = line.name?.trim();
    const amount = money(line.amount.amount);
    if (!name || !amount) {
      continue;
    }
    rows.push({ label: name, value: formatDetailEuro(amount.amount) });
  }
  if (extras.adminFees?.label?.trim() && money(extras.adminFees.amount)) {
    rows.push({
      label: extras.adminFees.label.trim(),
      value: formatDetailEuro(extras.adminFees.amount),
    });
  }
  if (extras.guaranteeFund?.name?.trim()) {
    const note = extras.guaranteeFund.note?.trim();
    rows.push({
      label: extras.guaranteeFund.name.trim(),
      value: note || 'inbegrepen',
      tone: note ? undefined : 'included',
    });
  }
  const transfer = transferLabel(extras);
  if (transfer) {
    rows.push({
      label: 'Transfer',
      value: transfer,
      tone: extras.transfer?.status === 'included' ? 'included' : undefined,
    });
  }
  return rows;
}

export function journeyRouteLabel(
  extras: DetailOfferExtras,
  direction: 'outbound' | 'inbound',
): string | undefined {
  const airport = extras.departureAirportLabel?.trim();
  const code = extras.departureAirportCode?.trim();
  const from = airport ? (code ? `${airport} (${code})` : airport) : code;
  const to = extras.arrivalAirport?.trim() || extras.destinationLabel?.trim();
  if (direction === 'outbound') {
    if (from && to) {
      return `${from} → ${to}`;
    }
    return from || to;
  }
  if (from && to) {
    return `${to} → ${from}`;
  }
  return from || to;
}

function roomTypeFromOffer(offer: TravelOffer, explicit: string | undefined): string | undefined {
  const chosen = explicit?.trim();
  if (chosen && !looksLikeTechnicalDisplayText(chosen)) {
    return chosen;
  }
  const extra = offer.extraInfo?.trim();
  if (extra && extra.length <= 120 && !looksLikeTechnicalDisplayText(extra)) {
    return extra;
  }
  return undefined;
}

/**
 * Build extras from fields the offer already carries.
 * Does not multiply p.p. by travellers. Does not invent list prices,
 * flight schedules, fees or a day programme.
 */
export function buildDetailOfferExtras(
  offer: TravelOffer,
  params: SearchParams,
  options: { roomTypeLabel?: string } = {},
): DetailOfferExtras {
  const partyParts = formatOccupancySummaryParts(params, { includeRooms: false });
  const partyWithRooms = formatOccupancySummaryParts(params, { includeRooms: true });
  const departureIso = normalizeDepartureDateToIso(offer.departureDate) ?? undefined;
  const returnIso = departureIso ? catalogReturnDateIso(offer, departureIso) ?? undefined : undefined;
  const departureAirportLabel = formatDepartureAirport(offer);
  const departureAirportCode = iataCode(offer.departureAirportCode) ?? iataCode(offer.departureAirport);
  const arrivalRaw = offer.arrivalAirport?.trim();
  const arrivalIsDeparture = Boolean(
    arrivalRaw
    && (
      arrivalRaw.toLowerCase() === departureAirportLabel?.toLowerCase()
      || arrivalRaw.toLowerCase() === departureAirportCode?.toLowerCase()
      || arrivalRaw.toLowerCase() === offer.departureAirport?.trim().toLowerCase()
    ),
  );
  const board = boardTypeLabelForDutchUi(offer.boardType);
  const flightIncluded = flightIncludedFlag(offer.flightIncluded);
  const total = money(offer.liveTotalPrice ?? Number.NaN);
  const perPerson = money(offer.price);
  const departureDateLabel = departureIso ? formatTripDateNl(departureIso) : undefined;
  const returnDateLabel = (returnIso ? formatTripDateNl(returnIso) : undefined) ?? formatOfferReturnDateLabel(offer);
  const roomTypeLabel = roomTypeFromOffer(offer, options.roomTypeLabel);
  const durationLabel = formatNightsLabel(offer.nights, offer.durationType, offer.provider);
  const destinationLabel = offer.destinationCity?.trim();

  return {
    ...(total ? { liveTotalPrice: total } : {}),
    ...(perPerson ? { livePricePerPerson: perPerson } : {}),
    ...(departureIso ? { departureDateIso: departureIso } : {}),
    ...(departureDateLabel ? { departureDateLabel } : {}),
    ...(returnIso ? { returnDateIso: returnIso } : {}),
    ...(returnDateLabel ? { returnDateLabel } : {}),
    ...(departureAirportLabel ? { departureAirportLabel } : {}),
    ...(departureAirportCode ? { departureAirportCode } : {}),
    ...(destinationLabel ? { destinationLabel } : {}),
    ...(board ? { boardType: board } : {}),
    ...(flightIncluded !== undefined ? { flightIncluded } : {}),
    ...(roomTypeLabel ? { roomTypeLabel } : {}),
    ...(durationLabel ? { durationLabel } : {}),
    ...(partyParts.length > 0 ? { partyLabel: partyParts.join(', ') } : {}),
    ...(partyWithRooms.length > 0 ? { partyWithRoomsLabel: partyWithRooms.join(' • ') } : {}),
    ...(arrivalRaw && !arrivalIsDeparture ? { arrivalAirport: arrivalRaw } : {}),
    ...(offerHasCarRental(offer) ? { carRentalIncluded: true } : {}),
    ...(isProvenFlyAndDriveRondreis(offer) ? { tripBadge: 'Fly & Drive' } : {}),
  };
}
