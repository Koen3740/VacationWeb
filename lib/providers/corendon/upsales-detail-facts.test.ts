import assert from 'node:assert/strict';
import test from 'node:test';
import { readCorendonUpsalesDetailFacts } from './upsales-detail-facts';

const TRIP_CODE = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';

function body(extra: Record<string, unknown> = {}): unknown {
  return {
    result: {
      extendedTripCode: TRIP_CODE,
      prices: { totalPrice: 1757 },
      selectedTripCudl: {
        selectedTrip: { system: { request: { departureDate: '2026-08-27' } } },
      },
      ...extra,
    },
  };
}

test('upsales detail facts stay empty when the price body has no flight or transfer keys', () => {
  assert.equal(readCorendonUpsalesDetailFacts(body()), undefined);
});

test('upsales maps outbound and return times, airline, number, arrival, baggage and a bookable transfer', () => {
  const facts = readCorendonUpsalesDetailFacts(body({
    hasStandardTransfer: false,
    isStandardTransferFree: false,
    prices: {
      totalPrice: 1757,
      additionalServicePrices: [
        { id: 'transfer', remark: 'Je kunt de transfer als extra bijboeken.', price: 0 },
      ],
    },
    trip: {
      departureFlight: {
        depHour: 6,
        depMin: 5,
        arrHour: '10',
        arrMin: '15',
        airlineName: 'Corendon Airlines',
        airlineCode: 'XC',
        flightNumber: 'XC100',
        flightCode: 'IGNORED1',
        freeLuggageWeight: 20,
        arrivalAirportCode: 'tfs',
        departureAirportCode: 'BRU',
      },
      returnFlight: {
        depHour: 18,
        depMin: 10,
        arrHour: 21,
        arrMin: 55,
        airlineName: 'Corendon Airlines',
        flightNumber: 'XC101',
        freeLuggageWeight: '23kg',
      },
    },
  }));

  assert.deepEqual(facts, {
    arrivalAirport: 'TFS',
    flights: [
      {
        direction: 'outbound',
        departureAirportCode: 'BRU',
        arrivalAirportCode: 'TFS',
        departureAt: '06:05',
        arrivalAt: '10:15',
        airlineName: 'Corendon Airlines',
        airlineCode: 'XC',
        flightNumber: 'XC100',
        baggageKg: 20,
      },
      {
        direction: 'inbound',
        departureAt: '18:10',
        arrivalAt: '21:55',
        airlineName: 'Corendon Airlines',
        flightNumber: 'XC101',
        baggageKg: 23,
      },
    ],
    transfer: {
      status: 'bookable',
      remark: 'Je kunt de transfer als extra bijboeken.',
    },
  });
});

test('a free standard transfer is included, and a zero weight or missing minute is omitted', () => {
  const facts = readCorendonUpsalesDetailFacts(body({
    isStandardTransferFree: true,
    trip: {
      departureFlight: {
        depHour: 7,
        airlineName: 'Corendon Airlines',
        freeLuggageWeight: 0,
        arrivalAirportCode: 'AGP',
      },
    },
    selectedTripCudl: {
      selectedTrip: {
        system: { request: { departureDate: '2026-08-27' } },
        flights: [
          {
            departure: { time: '2026-12-13T07:40:00' },
            arrival: { time: '11:05' },
            airline: 'Fallback Air',
          },
        ],
      },
    },
  }));

  assert.equal(facts?.transfer?.status, 'included');
  assert.equal(facts?.transfer?.remark, undefined);
  assert.equal(facts?.flights?.[0]?.departureAt, '07:40');
  assert.equal(facts?.flights?.[0]?.arrivalAt, '11:05');
  assert.equal(facts?.flights?.[0]?.airlineName, 'Corendon Airlines');
  assert.equal(facts?.flights?.[0]?.baggageKg, undefined);
  assert.equal(facts?.arrivalAirport, 'AGP');
  assert.equal(facts?.flights?.length, 1);
});

test('schedule flights fill a missing trip block, and a contradictory bookable remark is not called included', () => {
  const facts = readCorendonUpsalesDetailFacts({
    result: {
      prices: {
        additionalServicePrices: {
          transfer: { id: 'transfer', remark: 'Je kunt de transfer als extra bijboeken.', price: 49 },
        },
      },
      selectedTripCudl: {
        selectedTrip: {
          flights: [
            {
              direction: 'outbound',
              departure: { time: '06:40', airportCode: 'BRU' },
              arrival: { time: '09:25', airportCode: 'AGP' },
              airline: { name: 'Corendon Airlines', code: 'XC' },
              flightNumber: 'XC 1234',
              freeLuggageWeight: 20,
            },
            {
              direction: 'return',
              departure: { time: '18:10' },
              arrival: { time: '21:55' },
              airline: 'Corendon Airlines',
              flightCode: 'XC1235',
            },
          ],
        },
      },
    },
  });

  assert.equal(facts?.flights?.[0]?.flightNumber, 'XC1234');
  assert.equal(facts?.flights?.[0]?.departureAirportCode, 'BRU');
  assert.equal(facts?.flights?.[1]?.direction, 'inbound');
  assert.equal(facts?.flights?.[1]?.flightNumber, 'XC1235');
  assert.equal(facts?.arrivalAirport, 'AGP');
  assert.equal(facts?.transfer?.status, 'bookable');
  assert.equal(facts?.transfer?.price, 49);
});
