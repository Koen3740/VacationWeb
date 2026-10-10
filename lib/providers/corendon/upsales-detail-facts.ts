/**
 * Optional Corendon detail rows from the upsales JSON already fetched for the price.
 * No second request. A field is kept only when that key is present and usable.
 */

import type { LiveDetailFacts, LiveFlightLeg, LiveTransferFact } from '@/lib/offers/live-detail-facts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRoot(json: unknown): Record<string, unknown> | null {
  if (!isRecord(json)) {
    return null;
  }
  if (isRecord(json.result)) {
    return json.result;
  }
  const content = json.content;
  if (isRecord(content) && isRecord(content.result)) {
    return content.result;
  }
  return json;
}

function cleanText(value: unknown, max = 180): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > max) {
    return undefined;
  }
  return text;
}

function clockPart(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d{1,2}$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

function clock(hour: unknown, minute: unknown): string | undefined {
  const h = clockPart(hour);
  const m = clockPart(minute);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) {
    return undefined;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = value.trim().match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) {
    return undefined;
  }
  return clock(match[1], match[2]);
}

function iata(value: unknown): string | undefined {
  const text = cleanText(value, 8);
  if (!text || !/^[A-Za-z]{3}$/.test(text)) {
    return undefined;
  }
  return text.toUpperCase();
}

function airlineCode(value: unknown): string | undefined {
  const text = cleanText(value, 4);
  if (!text || !/^[A-Za-z0-9]{2,3}$/.test(text)) {
    return undefined;
  }
  return text.toUpperCase();
}

function flightNumber(value: unknown): string | undefined {
  const text = cleanText(value, 12);
  if (!text || !/\d/.test(text) || !/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(text)) {
    return undefined;
  }
  return text.toUpperCase().replace(/\s+/g, '');
}

function baggageKg(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 60) {
    return value;
  }
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{1,2})(?:\s*kg)?$/i);
    if (!match) {
      return undefined;
    }
    const weight = Number(match[1]);
    if (weight > 0 && weight <= 60) {
      return weight;
    }
  }
  return undefined;
}

function positiveAmount(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return numeric;
}

function readBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return undefined;
}

function airlineFrom(value: unknown): { airlineName?: string; airlineCode?: string } {
  if (typeof value === 'string') {
    const airlineName = cleanText(value, 60);
    return airlineName ? { airlineName } : {};
  }
  if (!isRecord(value)) {
    return {};
  }
  const airlineName = cleanText(value.name ?? value.airlineName, 60);
  const code = airlineCode(value.code ?? value.airlineCode);
  return {
    ...(airlineName ? { airlineName } : {}),
    ...(code ? { airlineCode: code } : {}),
  };
}

function pointTime(point: unknown): string | undefined {
  if (typeof point === 'string') {
    return timeFromUnknown(point);
  }
  if (!isRecord(point)) {
    return undefined;
  }
  return timeFromUnknown(point.time) ?? clock(point.hour ?? point.depHour ?? point.arrHour, point.minute ?? point.min);
}

function pointAirport(point: unknown): string | undefined {
  if (!isRecord(point)) {
    return undefined;
  }
  return iata(point.airportCode ?? point.code ?? point.airport);
}

type LegDraft = {
  direction: 'outbound' | 'inbound';
  departureAirportCode?: string;
  arrivalAirportCode?: string;
  departureAt?: string;
  arrivalAt?: string;
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  baggageKg?: number;
};

function draftFromTripFlight(raw: unknown, direction: 'outbound' | 'inbound'): LegDraft | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const airline = airlineFrom(raw.airline ?? raw.airlineName);
  const draft: LegDraft = {
    direction,
    ...(iata(raw.departureAirportCode) ? { departureAirportCode: iata(raw.departureAirportCode) } : {}),
    ...(iata(raw.arrivalAirportCode) ? { arrivalAirportCode: iata(raw.arrivalAirportCode) } : {}),
    ...(clock(raw.depHour, raw.depMin) ? { departureAt: clock(raw.depHour, raw.depMin) } : {}),
    ...(clock(raw.arrHour, raw.arrMin) ? { arrivalAt: clock(raw.arrHour, raw.arrMin) } : {}),
    ...(airline.airlineName || cleanText(raw.airlineName, 60)
      ? { airlineName: airline.airlineName ?? cleanText(raw.airlineName, 60) }
      : {}),
    ...(airline.airlineCode || airlineCode(raw.airlineCode)
      ? { airlineCode: airline.airlineCode ?? airlineCode(raw.airlineCode) }
      : {}),
    ...(flightNumber(raw.flightNumber) ?? flightNumber(raw.flightCode)
      ? { flightNumber: flightNumber(raw.flightNumber) ?? flightNumber(raw.flightCode) }
      : {}),
    ...(baggageKg(raw.freeLuggageWeight) != null ? { baggageKg: baggageKg(raw.freeLuggageWeight) } : {}),
  };
  return draft;
}

function draftFromSchedule(raw: unknown, direction: 'outbound' | 'inbound'): LegDraft | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const airline = airlineFrom(raw.airline ?? raw.airlineName);
  const number = flightNumber(raw.flightNumber) ?? flightNumber(raw.flightCode);
  const draft: LegDraft = {
    direction,
    ...(pointAirport(raw.departure) ? { departureAirportCode: pointAirport(raw.departure) } : {}),
    ...(pointAirport(raw.arrival) ? { arrivalAirportCode: pointAirport(raw.arrival) } : {}),
    ...(pointTime(raw.departure) ? { departureAt: pointTime(raw.departure) } : {}),
    ...(pointTime(raw.arrival) ? { arrivalAt: pointTime(raw.arrival) } : {}),
    ...(airline.airlineName ? { airlineName: airline.airlineName } : {}),
    ...(airline.airlineCode ? { airlineCode: airline.airlineCode } : {}),
    ...(number ? { flightNumber: number } : {}),
    ...(baggageKg(raw.freeLuggageWeight) != null ? { baggageKg: baggageKg(raw.freeLuggageWeight) } : {}),
  };
  return draft;
}

function mergeLeg(primary: LegDraft | undefined, fallback: LegDraft | undefined): LegDraft | undefined {
  if (!primary && !fallback) {
    return undefined;
  }
  const direction = primary?.direction ?? fallback?.direction;
  if (!direction) {
    return undefined;
  }
  const merged: LegDraft = {
    direction,
    departureAirportCode: primary?.departureAirportCode ?? fallback?.departureAirportCode,
    arrivalAirportCode: primary?.arrivalAirportCode ?? fallback?.arrivalAirportCode,
    departureAt: primary?.departureAt ?? fallback?.departureAt,
    arrivalAt: primary?.arrivalAt ?? fallback?.arrivalAt,
    airlineName: primary?.airlineName ?? fallback?.airlineName,
    airlineCode: primary?.airlineCode ?? fallback?.airlineCode,
    flightNumber: primary?.flightNumber ?? fallback?.flightNumber,
    baggageKg: primary?.baggageKg ?? fallback?.baggageKg,
  };
  if (
    !merged.departureAt
    && !merged.arrivalAt
    && !merged.airlineName
    && !merged.airlineCode
    && !merged.flightNumber
    && merged.baggageKg == null
  ) {
    return undefined;
  }
  return merged;
}

function toLeg(draft: LegDraft): LiveFlightLeg {
  const leg: LiveFlightLeg = { direction: draft.direction };
  if (draft.departureAirportCode) leg.departureAirportCode = draft.departureAirportCode;
  if (draft.arrivalAirportCode) leg.arrivalAirportCode = draft.arrivalAirportCode;
  if (draft.departureAt) leg.departureAt = draft.departureAt;
  if (draft.arrivalAt) leg.arrivalAt = draft.arrivalAt;
  if (draft.airlineName) leg.airlineName = draft.airlineName;
  if (draft.airlineCode) leg.airlineCode = draft.airlineCode;
  if (draft.flightNumber) leg.flightNumber = draft.flightNumber;
  if (draft.baggageKg != null) leg.baggageKg = draft.baggageKg;
  return leg;
}

function explicitDirection(raw: unknown): 'outbound' | 'inbound' | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const label = String(raw.direction ?? raw.type ?? raw.leg ?? '').toLowerCase();
  if (/return|inbound|terug/.test(label)) {
    return 'inbound';
  }
  if (/depart|outbound|heen/.test(label)) {
    return 'outbound';
  }
  return undefined;
}

function readScheduleLegs(root: Record<string, unknown>): { outbound?: LegDraft; inbound?: LegDraft } {
  const selected = isRecord(root.selectedTripCudl) ? root.selectedTripCudl.selectedTrip : root.selectedTrip;
  const flights = isRecord(selected) && Array.isArray(selected.flights) ? selected.flights : [];
  const found: { outbound?: LegDraft; inbound?: LegDraft } = {};
  flights.slice(0, 2).forEach((item) => {
    const direction = explicitDirection(item)
      ?? (!found.outbound ? 'outbound' : !found.inbound ? 'inbound' : undefined);
    if (!direction || found[direction]) {
      return;
    }
    const draft = draftFromSchedule(item, direction);
    if (draft) {
      found[direction] = draft;
    }
  });
  return found;
}

function suggestsBookable(remark: string | undefined): boolean {
  return Boolean(remark && /bij\s*te\s*boeken|bijboeken|optioneel|als extra/i.test(remark));
}

function readServiceList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    return Object.values(value).filter(isRecord);
  }
  return [];
}

function readTransfer(root: Record<string, unknown>): LiveTransferFact | undefined {
  const trip = isRecord(root.trip) ? root.trip : undefined;
  const includedFree = readBool(root.isStandardTransferFree ?? trip?.isStandardTransferFree);
  const hasStandard = readBool(root.hasStandardTransfer ?? trip?.hasStandardTransfer);
  const prices = isRecord(root.prices) ? root.prices : undefined;
  const service = readServiceList(prices?.additionalServicePrices).find((item) => {
    const id = String(item.id ?? '').trim().toLowerCase();
    const name = String(item.name ?? item.label ?? '').trim().toLowerCase();
    return id === 'transfer' || name === 'transfer';
  });
  const remark = service ? cleanText(service.remark) : undefined;
  const price = service ? positiveAmount(service.price) : undefined;

  if (includedFree === true) {
    return {
      status: 'included',
      ...(remark && !suggestsBookable(remark) ? { remark } : {}),
    };
  }
  if (remark || (hasStandard === false && service)) {
    return {
      status: 'bookable',
      ...(remark ? { remark } : {}),
      ...(price != null ? { price } : {}),
    };
  }
  return undefined;
}

/**
 * Map flight times, airline, flight number, arrival airport, baggage weight and transfer
 * from one upsales payload. Returns undefined when none of those fields are present.
 */
export function readCorendonUpsalesDetailFacts(json: unknown): LiveDetailFacts | undefined {
  const root = readRoot(json);
  if (!root) {
    return undefined;
  }
  const trip = isRecord(root.trip) ? root.trip : undefined;
  const schedule = readScheduleLegs(root);
  const tripOutbound = trip ? draftFromTripFlight(trip.departureFlight, 'outbound') : undefined;
  const tripInbound = trip ? draftFromTripFlight(trip.returnFlight, 'inbound') : undefined;
  const outbound = mergeLeg(tripOutbound, schedule.outbound);
  const inbound = mergeLeg(tripInbound, schedule.inbound);
  const flights = [outbound, inbound].filter((leg): leg is LegDraft => Boolean(leg)).map(toLeg);
  const arrivalAirport = outbound?.arrivalAirportCode
    ?? tripOutbound?.arrivalAirportCode
    ?? schedule.outbound?.arrivalAirportCode;
  const transfer = readTransfer(root);
  if (flights.length === 0 && !arrivalAirport && !transfer) {
    return undefined;
  }
  return {
    ...(flights.length > 0 ? { flights } : {}),
    ...(arrivalAirport ? { arrivalAirport } : {}),
    ...(transfer ? { transfer } : {}),
  };
}
