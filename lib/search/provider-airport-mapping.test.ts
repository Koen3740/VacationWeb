import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listAirportCompleteProviders,
  listAirportFollowUpProviders,
  mapCorendonAirportRouteInbound,
  mapProviderAirportInbound,
  mapProviderAirportOutbound,
  resolveInboundAirportRaw,
} from './provider-airport-mapping';
import { canonicalizeDepartureAirportCode } from './departure-airports';

test('Corendon inbound: feed IATA and airportRoute prefix', () => {
  assert.equal(mapProviderAirportInbound('corendon', 'BRU').status, 'MAPPED');
  assert.equal(mapProviderAirportInbound('corendon', 'BRU').canonicalIata, 'BRU');
  assert.equal(mapProviderAirportInbound('corendon', 'BE').status, 'NOT_APPLICABLE');
  assert.equal(mapCorendonAirportRouteInbound('BRUCFU').canonicalIata, 'BRU');
  assert.equal(mapCorendonAirportRouteInbound('EINPMI').canonicalIata, 'EIN');
  assert.equal(mapCorendonAirportRouteInbound('BRUCFU').status, 'MAPPED');
  assert.equal(mapProviderAirportInbound('corendon', 'BRUCFU').canonicalIata, 'BRU');
});

test('Corendon outbound: IATA alone is NOT_APPLICABLE (needs airportRoute)', () => {
  const out = mapProviderAirportOutbound('corendon', 'BRU');
  assert.equal(out.status, 'NOT_APPLICABLE');
  assert.equal(out.outboundValue, undefined);
});

test('Sunweb inbound: IATA, XX-IATA, place names, none', () => {
  assert.equal(mapProviderAirportInbound('sunweb', 'CRL').canonicalIata, 'CRL');
  assert.equal(mapProviderAirportInbound('sunweb', 'BE-BRU').canonicalIata, 'BRU');
  assert.equal(mapProviderAirportInbound('sunweb', 'NL-AMS').canonicalIata, 'AMS');
  assert.equal(mapProviderAirportInbound('sunweb', 'DE-CGN').canonicalIata, 'CGN');
  assert.equal(mapProviderAirportInbound('sunweb', 'Brussel Zaventem').canonicalIata, 'BRU');
  assert.equal(mapProviderAirportInbound('sunweb', 'Köln/Bonn').canonicalIata, 'CGN');
  assert.equal(mapProviderAirportInbound('sunweb', 'Weeze').canonicalIata, 'NRN');
  assert.equal(mapProviderAirportInbound('sunweb', 'none').status, 'NOT_APPLICABLE');
});

test('forensic negatives: country ISO / sentinels / empty never become airports', () => {
  for (const country of ['BE', 'NL', 'DE', 'FR', 'LU'] as const) {
    const result = resolveInboundAirportRaw(country, { source: 'IsoCodeDeparture' });
    assert.equal(result.status, 'NOT_APPLICABLE', country);
    assert.equal(result.canonicalIata, undefined, country);
    assert.equal(canonicalizeDepartureAirportCode(country), undefined, country);
    assert.equal(mapProviderAirportInbound('sunweb', country).status, 'NOT_APPLICABLE', country);
    assert.equal(mapProviderAirportInbound('corendon', country).status, 'NOT_APPLICABLE', country);
  }

  assert.equal(resolveInboundAirportRaw('none').status, 'NOT_APPLICABLE');
  assert.equal(resolveInboundAirportRaw('').status, 'UNMAPPED');
  assert.equal(canonicalizeDepartureAirportCode(''), undefined);
  assert.equal(canonicalizeDepartureAirportCode(null), undefined);

  for (const text of ['unknown', 'random text', 'Brussel', 'Zaventem', 'Brussel Airport', 'Amsterdam Schiphol', 'Köln']) {
    const result = resolveInboundAirportRaw(text);
    assert.equal(result.status, 'UNKNOWN', text);
    assert.equal(result.canonicalIata, undefined, text);
    assert.equal(canonicalizeDepartureAirportCode(text), undefined, text);
  }
});

test('forensic: plain-text is exact-key only (no substring / fuzzy)', () => {
  assert.equal(mapProviderAirportInbound('sunweb', 'Brussel Zaventem').canonicalIata, 'BRU');
  assert.equal(mapProviderAirportInbound('sunweb', 'Brussel Charleroi').canonicalIata, 'CRL');
  // Near-misses must not inherit from proven names
  assert.equal(mapProviderAirportInbound('sunweb', 'Brussel').status, 'UNKNOWN');
  assert.equal(mapProviderAirportInbound('sunweb', 'Brussel Zaventem Airport').status, 'UNKNOWN');
  assert.equal(mapProviderAirportInbound('sunweb', 'Zaventem').status, 'UNKNOWN');
});

test('Sunweb/Eliza outbound: identity IATA', () => {
  assert.equal(mapProviderAirportOutbound('sunweb', 'BRU').outboundValue, 'BRU');
  assert.equal(mapProviderAirportOutbound('sunweb', 'BRU').status, 'MAPPED');
  assert.equal(mapProviderAirportOutbound('eliza', 'NRN').outboundValue, 'NRN');
});

test('Eliza inbound: IATA mapped; unknown text not inventively remapped', () => {
  assert.equal(mapProviderAirportInbound('eliza', 'BRU').status, 'MAPPED');
  const unknown = mapProviderAirportInbound('eliza', 'Some Random Field');
  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(unknown.canonicalIata, undefined);
  assert.equal(canonicalizeDepartureAirportCode('Some Random Field'), undefined);
});

test('IATA outside registry is CANONICAL_AIRPORT_MISSING — not remapped', () => {
  const missing = resolveInboundAirportRaw('XYZ');
  assert.equal(missing.status, 'CANONICAL_AIRPORT_MISSING');
  assert.equal(missing.canonicalIata, 'XYZ');
  // canonicalize keeps token for filter identity; does not convert to another airport
  assert.equal(canonicalizeDepartureAirportCode('XYZ'), 'XYZ');
  assert.notEqual(canonicalizeDepartureAirportCode('XYZ'), 'BRU');
});

test('Vakanties.nl / De Jong / TravelDeal: empty = UNMAPPED, not invented', () => {
  for (const provider of ['vakanties_nl', 'de_jong_intra', 'traveldeal'] as const) {
    const result = mapProviderAirportInbound(provider, '');
    assert.equal(result.status, 'UNMAPPED');
    assert.equal(result.canonicalIata, undefined);
    const outbound = mapProviderAirportOutbound(provider, 'BRU');
    assert.equal(outbound.status, 'UNMAPPED');
  }
});

test('airport-complete vs follow-up provider lists', () => {
  assert.deepEqual(listAirportCompleteProviders(), ['corendon', 'sunweb', 'eliza']);
  assert.deepEqual(listAirportFollowUpProviders(), [
    'vakanties_nl',
    'de_jong_intra',
    'traveldeal',
  ]);
});
