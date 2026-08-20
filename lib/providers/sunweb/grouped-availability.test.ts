import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSunwebGroupedAvailabilityUrl,
  fetchSunwebExactTripAvailability,
  findExactSunwebGroupedAvailabilityRow,
  isSunwebDepartureDateBeforeToday,
  readSunwebGroupedPriceRows,
  sunwebGroupedRowMatchesExactTrip,
} from './grouped-availability';
import type { SunwebLiveContext } from './offer-context';
import { SUNWEB_FE_HOST, SUNWEB_GROUPED_PRICES_PATH } from './constants';

const BOOKING_GATE_ID = 'D7AF6C79-A074-4724-8595-F0A5DE507A04';
const CONTEXT_ITEM_ID = 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea';

function ctx(overrides: {
  accoId?: string;
  departureDate?: string;
  departureAirport?: string;
  duration?: string;
  mealplan?: string;
} = {}): SunwebLiveContext {
  const departureDate = overrides.departureDate ?? '2026-10-22';
  const departureAirport = overrides.departureAirport ?? 'CRL';
  const duration = overrides.duration ?? '8';
  const mealplan = overrides.mealplan ?? 'LO';
  const accoId = overrides.accoId ?? '6143876';
  return {
    accoId,
    landingUrl:
      `https://www.sunweb.be/nl/vakantie/spanje/hotel-alba` +
      `?Duration[0]=${duration}&TransportType[0]=Flight&Mealplan[0]=${mealplan}` +
      `&DepartureAirport[0]=${departureAirport}&DepartureDate[0]=${departureDate}` +
      `&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03` +
      `&Participants[1][0]=2014-06-14&Participants[1][1]=2018-01-22`,
    feHost: SUNWEB_FE_HOST,
    query: {
      accoId,
      departureDate,
      departureAirport,
      duration,
      mealplan,
      transportType: 'Flight',
      month: departureDate.slice(0, 7),
      participants: [
        { key: 'Participants[0][0]', value: '1990-01-15' },
        { key: 'Participants[0][1]', value: '1988-03-03' },
        { key: 'Participants[1][0]', value: '2014-06-14' },
        { key: 'Participants[1][1]', value: '2018-01-22' },
      ],
    },
  };
}

export function okGroupedPricesBody(
  rows: Array<{
    departureDate: string;
    duration: number | string;
    mealplan: string;
    transportType?: string;
  }>,
): string {
  return JSON.stringify({
    errors: [],
    data: {
      isEmptyResponse: rows.length === 0,
      prices: rows.map((row) => ({
        minPricePerPerson: 387.62,
        averagePrice: 387.62,
        totalPrice: 775.24,
        duration: row.duration,
        transportType: row.transportType ?? 'Flight',
        mealplan: row.mealplan,
        departureDate: row.departureDate,
      })),
    },
  });
}

const GUIDS = { contextItemId: CONTEXT_ITEM_ID, bookingGateId: BOOKING_GATE_ID };

test('J. past calendar date is unavailable without treating HTTP 400 as the signal', () => {
  assert.equal(isSunwebDepartureDateBeforeToday('2026-08-10', '2026-08-20'), true);
  assert.equal(isSunwebDepartureDateBeforeToday('2026-08-20', '2026-08-20'), false);
  assert.equal(isSunwebDepartureDateBeforeToday('2026-10-21', '2026-08-20'), false);
  assert.equal(isSunwebDepartureDateBeforeToday('not-a-date', '2026-08-20'), true);
});

test('C. 29-09 row does not match a 28-09 request', () => {
  const requested = ctx({ departureDate: '2026-09-28' });
  const rows = readSunwebGroupedPriceRows(
    JSON.parse(
      okGroupedPricesBody([{ departureDate: '2026-09-29', duration: 8, mealplan: 'LO' }]),
    ),
  );
  assert.ok(rows);
  assert.equal(findExactSunwebGroupedAvailabilityRow(rows, requested), null);
  assert.equal(
    sunwebGroupedRowMatchesExactTrip(rows[0], requested),
    false,
  );
});

test('D. exact date with wrong duration is not a match', () => {
  const requested = ctx({ departureDate: '2026-10-22', duration: '8' });
  const rows = readSunwebGroupedPriceRows(
    JSON.parse(
      okGroupedPricesBody([
        { departureDate: '2026-10-22', duration: 9, mealplan: 'LO' },
        { departureDate: '2026-10-22', duration: 10, mealplan: 'LO' },
        { departureDate: '2026-10-22', duration: 11, mealplan: 'LO' },
      ]),
    ),
  );
  assert.ok(rows);
  assert.equal(findExactSunwebGroupedAvailabilityRow(rows, requested), null);
});

test('E. exact date with wrong mealplan is not a match (LO ≠ HP ≠ AI)', () => {
  const requested = ctx({ departureDate: '2026-10-22', mealplan: 'LO' });
  const rows = readSunwebGroupedPriceRows(
    JSON.parse(
      okGroupedPricesBody([
        { departureDate: '2026-10-22', duration: 8, mealplan: 'HP' },
        { departureDate: '2026-10-22', duration: 8, mealplan: 'AI' },
      ]),
    ),
  );
  assert.ok(rows);
  assert.equal(findExactSunwebGroupedAvailabilityRow(rows, requested), null);
});

test('exact date + duration + mealplan + transport is a match', () => {
  const requested = ctx({ departureDate: '2026-10-22', duration: '8', mealplan: 'LO' });
  const rows = readSunwebGroupedPriceRows(
    JSON.parse(
      okGroupedPricesBody([{ departureDate: '2026-10-22', duration: 8, mealplan: 'LO' }]),
    ),
  );
  assert.ok(rows);
  assert.ok(findExactSunwebGroupedAvailabilityRow(rows, requested));
});

test('F/G. grouped URL uses this offer airport; never a substitute IATA', () => {
  const crl = new URL(buildSunwebGroupedAvailabilityUrl(ctx({ departureAirport: 'CRL' }), GUIDS));
  const bru = new URL(buildSunwebGroupedAvailabilityUrl(ctx({ departureAirport: 'BRU' }), GUIDS));
  assert.equal(crl.pathname, SUNWEB_GROUPED_PRICES_PATH);
  assert.equal(crl.searchParams.get('DepartureAirport[0]'), 'CRL');
  assert.notEqual(crl.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(bru.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.notEqual(bru.searchParams.get('DepartureAirport[0]'), 'CRL');
});

test('exact gate uses same-day DateFrom/DateTo and exact Duration[0]', () => {
  const url = new URL(
    buildSunwebGroupedAvailabilityUrl(ctx({ departureDate: '2026-10-21', duration: '8' }), GUIDS),
  );
  assert.equal(url.searchParams.get('DateFrom'), '2026-10-21');
  assert.equal(url.searchParams.get('DateTo'), '2026-10-21');
  assert.equal(url.searchParams.get('DepartureDate[0]'), '2026-10-21');
  assert.equal(url.searchParams.get('Duration[0]'), '8');
  assert.equal(url.searchParams.get('Duration[0]')?.includes(','), false);
  assert.equal(url.searchParams.get('bookingGateId'), BOOKING_GATE_ID);
  assert.equal(url.searchParams.get('contextItemId'), CONTEXT_ITEM_ID);
  assert.equal(url.searchParams.get('accoId'), '6143876');
  assert.equal(url.searchParams.get('Mealplan'), 'LO');
  assert.equal(url.searchParams.get('TransportType'), 'Flight');
});

test('H. 4P/2R availability URL carries search Participants', () => {
  const url = new URL(buildSunwebGroupedAvailabilityUrl(ctx(), GUIDS));
  assert.equal(url.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(url.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(url.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(url.searchParams.get('Participants[1][1]'), '2018-01-22');
});

test('missing prices array is not availability proof', () => {
  assert.equal(readSunwebGroupedPriceRows({ errors: [], data: {} }), null);
  assert.equal(readSunwebGroupedPriceRows(null), null);
  const empty = readSunwebGroupedPriceRows({ errors: [], data: { prices: [] } });
  assert.ok(empty);
  assert.equal(empty.length, 0);
});

test('fetch: exact row → available; wrong date / empty / HTTP failure fail closed', async () => {
  const requested = ctx({ departureDate: '2026-10-22' });
  const available = await fetchSunwebExactTripAvailability(requested, GUIDS, {
    fetchImpl: async () =>
      new Response(
        okGroupedPricesBody([{ departureDate: '2026-10-22', duration: 8, mealplan: 'LO' }]),
        { status: 200 },
      ),
  });
  assert.equal(available.ok, true);

  const missing = await fetchSunwebExactTripAvailability(
    ctx({ departureDate: '2026-10-21' }),
    GUIDS,
    {
      fetchImpl: async () =>
        new Response(
          okGroupedPricesBody([{ departureDate: '2026-10-22', duration: 8, mealplan: 'LO' }]),
          { status: 200 },
        ),
    },
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.reason, 'unavailable_trip');
  }

  const failed = await fetchSunwebExactTripAvailability(requested, GUIDS, {
    fetchImpl: async () => new Response('nope', { status: 500 }),
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.reason, 'http_error');
  }
});

test('J. past date does not call grouped API', async () => {
  let calls = 0;
  const result = await fetchSunwebExactTripAvailability(
    ctx({ departureDate: '2026-08-10' }),
    GUIDS,
    {
      todayIso: '2026-08-20',
      fetchImpl: async () => {
        calls += 1;
        throw new Error('grouped must not run for past dates');
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});
