/**
 * Ligging enrichment (SUB 27) applied at catalog build time, next to
 * `splitStoredCatalog`. Two steps, both deterministic and free of guesses:
 *
 * 1. Centre distance is a hotel fact. Importers read it per feed record
 *    (`afstand tot centrum`, first number); records of the same hotel that were
 *    not merged in the same bookable group get it here. If the records of one
 *    hotel state different numbers nothing is propagated (each keeps its own).
 * 2. `data/geo/hotel-geo.v1.json` (built by `scripts/build-hotel-geo.ts` from the
 *    SUB 27 results) supplies SMOD class, coast distance and strand information.
 *    An id/hotel that is not in the table stays unknown.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { hotelKeyFromOfferId } from './hotel-key';

export const HOTEL_GEO_RELATIVE_PATH = path.join('data', 'geo', 'hotel-geo.v1.json');

export type HotelGeoBeach = {
  /** Strand 'direct' (own value, never a distance). */
  bd?: 1;
  /** Stated strand distance in metres (only where not 'direct'). */
  bm?: number;
};

export type HotelGeoHotel = HotelGeoBeach & {
  /** GHS-SMOD class of the 1 km cell (uncertain / unavailable coordinates: absent). */
  s?: number;
  /** Distance to the OSM coastline in metres (absent = unknown). */
  c?: number;
};

export type HotelGeoTable = {
  schema: 1;
  meta: Record<string, unknown>;
  hotels: Record<string, HotelGeoHotel>;
  /** Strand info for offers of hotels whose offers disagree (offer id -> value). */
  offers: Record<string, HotelGeoBeach>;
};

export type HotelGeoApplyStats = {
  offers: number;
  withSettingClass: number;
  withCoastDistance: number;
  withBeachDirect: number;
  withBeachDistance: number;
  withCenterDistance: number;
  withCenterIsIn: number;
  hotelsWithConflictingCenter: number;
};

export function loadHotelGeoTable(cwd = process.cwd()): HotelGeoTable | null {
  const file = path.join(cwd, HOTEL_GEO_RELATIVE_PATH);
  if (!fs.existsSync(file)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as HotelGeoTable;
  if (parsed?.schema !== 1 || typeof parsed.hotels !== 'object' || parsed.hotels === null) {
    throw new Error(`${HOTEL_GEO_RELATIVE_PATH}: unsupported schema`);
  }
  return parsed;
}

type CenterFacts = { distances: Set<number>; isIn: boolean };

function collectCenterFacts(offers: readonly StoredOffer[]): Map<string, CenterFacts> {
  const byHotel = new Map<string, CenterFacts>();
  for (const offer of offers) {
    const key = hotelKeyFromOfferId(offer.externalId);
    if (!key) {
      continue;
    }
    const facts = byHotel.get(key) ?? { distances: new Set<number>(), isIn: false };
    if (typeof offer.centerDistanceM === 'number') {
      facts.distances.add(offer.centerDistanceM);
    }
    if (offer.centerIsIn === true) {
      facts.isIn = true;
    }
    byHotel.set(key, facts);
  }
  return byHotel;
}

export function applyHotelGeo(
  offers: readonly StoredOffer[],
  table: HotelGeoTable | null,
): { offers: StoredOffer[]; stats: HotelGeoApplyStats } {
  const center = collectCenterFacts(offers);
  const stats: HotelGeoApplyStats = {
    offers: offers.length,
    withSettingClass: 0,
    withCoastDistance: 0,
    withBeachDirect: 0,
    withBeachDistance: 0,
    withCenterDistance: 0,
    withCenterIsIn: 0,
    hotelsWithConflictingCenter: [...center.values()].filter((facts) => facts.distances.size > 1).length,
  };

  const enriched = offers.map((offer) => {
    const key = hotelKeyFromOfferId(offer.externalId);
    const next: StoredOffer = { ...offer };

    if (key) {
      const facts = center.get(key);
      if (facts && facts.distances.size === 1 && next.centerDistanceM === undefined) {
        next.centerDistanceM = [...facts.distances][0];
      }
      if (facts?.isIn && next.centerIsIn !== true) {
        next.centerIsIn = true;
      }
    }

    if (table && key) {
      const hotel = table.hotels[key];
      if (hotel?.s !== undefined) {
        next.settingClass = hotel.s;
      }
      if (hotel?.c !== undefined) {
        next.coastDistanceM = hotel.c;
      }
      const beach: HotelGeoBeach | undefined = table.offers[offer.externalId] ?? hotel;
      if (beach?.bd === 1) {
        next.beachDirect = true;
      } else if (typeof beach?.bm === 'number') {
        next.beachDistanceM = beach.bm;
      }
    }

    if (next.settingClass !== undefined) stats.withSettingClass += 1;
    if (next.coastDistanceM !== undefined) stats.withCoastDistance += 1;
    if (next.beachDirect === true) stats.withBeachDirect += 1;
    if (next.beachDistanceM !== undefined) stats.withBeachDistance += 1;
    if (next.centerDistanceM !== undefined) stats.withCenterDistance += 1;
    if (next.centerIsIn === true) stats.withCenterIsIn += 1;
    return next;
  });

  return { offers: enriched, stats };
}