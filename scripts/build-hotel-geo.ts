/**
 * Builds data/geo/hotel-geo.v1.json from the existing SUB 27 results (no new analysis).
 *
 *   npx tsx scripts/build-hotel-geo.ts --evidence <...\sub27-geo-poc-2026-09-29\results> \
 *     --strand <...\strandligging-analysis-2026-09-28\per-offer-classification.json> \
 *     [--catalog data/offers.json] [--out data/geo/hotel-geo.v1.json]
 *
 * Sources (all read-only):
 *   g2_offers.json               offer id + coordinates (8 238 offers)
 *   g4_coast.json                "lat,lon" -> OSM coast distance (m)
 *   g42_sets.json  Kust.work     offers with usable coordinates and coast <= 1 000 m (6 786)
 *   g47_smod_per_offer.json      GHS-SMOD class per offer (cls_used)
 *   per-offer-classification.json  strand: S3r (direct/le150/le500/le1000/gt1000/...), m
 *
 * Validation: the id sets of all sources are identical, and (with --catalog) equal the
 * catalog ids (8 238 = 8 238, 0 difference each way). Coast and SMOD must not differ inside
 * one hotel. Output is deterministic (sorted keys, no timestamp).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { HotelGeoBeach, HotelGeoHotel, HotelGeoTable } from '../lib/offers/hotel-geo';
import { hotelKeyFromOfferId } from '../lib/offers/hotel-key';

type G2Row = { id: string; lat: number | null; lon: number | null };
type G47Row = { cls_used: number | null };
type StrandRow = { id: string; S3r: string; m: number | null; coastOsmM: number | null };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function need(name: string): string {
  const value = arg(name);
  if (!value) {
    throw new Error(`missing --${name}`);
  }
  return value;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function diff(label: string, a: Set<string>, b: Set<string>): void {
  const onlyA = [...a].filter((id) => !b.has(id));
  const onlyB = [...b].filter((id) => !a.has(id));
  if (onlyA.length || onlyB.length) {
    throw new Error(`${label}: id sets differ (${onlyA.length} only left, ${onlyB.length} only right)`);
  }
}

function coordKey(lat: number, lon: number): string {
  return `${Number(lat.toFixed(6))},${Number(lon.toFixed(6))}`;
}

function main(): void {
  const evidence = need('evidence');
  const strandFile = need('strand');
  const outFile = arg('out') ?? path.join('data', 'geo', 'hotel-geo.v1.json');
  const catalogFile = arg('catalog');

  const files = {
    g2: path.join(evidence, 'g2_offers.json'),
    g4: path.join(evidence, 'g4_coast.json'),
    g42: path.join(evidence, 'g42_sets.json'),
    g47: path.join(evidence, 'g47_smod_per_offer.json'),
    strand: strandFile,
  };

  const g2 = readJson<G2Row[]>(files.g2);
  const g4 = readJson<Record<string, { osm: number | null }>>(files.g4);
  const kustWork = new Set(readJson<{ Kust: { work: string[] } }>(files.g42).Kust.work);
  const g47 = readJson<Record<string, G47Row>>(files.g47);
  const strand = readJson<StrandRow[]>(files.strand);

  const ids = new Set(g2.map((row) => row.id));
  diff('g2 vs g47', ids, new Set(Object.keys(g47)));
  diff('g2 vs strand', ids, new Set(strand.map((row) => row.id)));
  if (g2.length !== ids.size) {
    throw new Error('duplicate ids in g2');
  }
  if (catalogFile) {
    const catalog = readJson<Array<{ externalId?: string; id?: string }>>(catalogFile);
    const catalogIds = new Set(catalog.map((offer) => String(offer.externalId ?? offer.id)));
    diff('catalog vs geo', catalogIds, ids);
    console.log(`catalog ids ${catalogIds.size} = geo ids ${ids.size}`);
  }
  for (const id of kustWork) {
    if (!ids.has(id)) {
      throw new Error(`Kust.work id not in offers: ${id}`);
    }
  }

  const strandById = new Map(strand.map((row) => [row.id, row]));
  const hotels = new Map<string, { s: Set<number | null>; c: Set<number | null>; beach: Map<string, HotelGeoBeach> }>();
  let coastMismatch = 0;
  let coastFarDifferences = 0;

  for (const row of g2) {
    const key = hotelKeyFromOfferId(row.id);
    if (!key) {
      throw new Error(`no hotel key: ${row.id}`);
    }
    const entry = hotels.get(key) ?? { s: new Set(), c: new Set(), beach: new Map() };
    hotels.set(key, entry);

    entry.s.add(g47[row.id].cls_used ?? null);

    let coast: number | null = null;
    if (typeof row.lat === 'number' && typeof row.lon === 'number') {
      const found = g4[coordKey(row.lat, row.lon)]?.osm;
      coast = typeof found === 'number' ? found : null;
    }
    const classified = strandById.get(row.id)!;
    const otherCoast = classified.coastOsmM ?? null;
    if (otherCoast !== coast) {
      // Both files must agree wherever it matters for Kust (<= 1 000 m); far values (> 20 km) may differ.
      if ((coast !== null && coast <= 1000) || (otherCoast !== null && otherCoast <= 1000)) {
        coastMismatch += 1;
      } else {
        coastFarDifferences += 1;
      }
    }
    // Kust set = usable coordinates: coast <= 1 000 m only counts when the offer is in Kust.work.
    if (coast !== null && coast <= 1000 && !kustWork.has(row.id)) {
      coast = null;
    }
    entry.c.add(coast);

    const beach: HotelGeoBeach = {};
    if (classified.S3r === 'direct') {
      beach.bd = 1;
    } else if (['le150', 'le500', 'le1000', 'gt1000'].includes(classified.S3r)) {
      if (typeof classified.m !== 'number') {
        throw new Error(`strand ${classified.S3r} without m: ${row.id}`);
      }
      beach.bm = Math.round(classified.m);
    }
    entry.beach.set(row.id, beach);
  }
  if (coastMismatch > 0) {
    throw new Error(`coast join differs from per-offer-classification.coastOsmM for ${coastMismatch} offers`);
  }

  const table: HotelGeoTable = { schema: 1, meta: {}, hotels: {}, offers: {} };
  let hotelsWithBeachConflict = 0;
  for (const key of [...hotels.keys()].sort()) {
    const entry = hotels.get(key)!;
    if (entry.s.size > 1 || entry.c.size > 1) {
      throw new Error(`hotel ${key}: SMOD/coast differ between offers`);
    }
    const hotel: HotelGeoHotel = {};
    const settingClass = [...entry.s][0];
    const coast = [...entry.c][0];
    if (settingClass !== null && settingClass !== undefined) hotel.s = settingClass;
    if (coast !== null && coast !== undefined) hotel.c = coast;

    const beachValues = new Set([...entry.beach.values()].map((value) => JSON.stringify(value)));
    if (beachValues.size === 1) {
      Object.assign(hotel, [...entry.beach.values()][0]);
    } else {
      hotelsWithBeachConflict += 1;
      for (const id of [...entry.beach.keys()].sort()) {
        const value = entry.beach.get(id)!;
        if (value.bd === 1 || typeof value.bm === 'number') {
          table.offers[id] = value;
        }
      }
    }
    if (Object.keys(hotel).length > 0) {
      table.hotels[key] = hotel;
    }
  }

  const count = (predicate: (id: string) => boolean) => g2.filter((row) => predicate(row.id)).length;
  const hotelOf = (id: string) => table.hotels[hotelKeyFromOfferId(id)!];
  const beachOf = (id: string) => table.offers[id] ?? hotelOf(id);
  const counts = {
    offers: ids.size,
    hotels: hotels.size,
    hotelsWithBeachConflict,
    coastFarDifferencesIgnored: coastFarDifferences,
    urban: count((id) => [30, 23, 22].includes(hotelOf(id)?.s ?? -1)),
    rural: count((id) => [13, 12, 11].includes(hotelOf(id)?.s ?? -1)),
    settingClass21: count((id) => hotelOf(id)?.s === 21),
    settingClassOther10: count((id) => hotelOf(id)?.s === 10),
    settingUnknown: count((id) => hotelOf(id)?.s === undefined),
    coastLe1000: count((id) => (hotelOf(id)?.c ?? Infinity) <= 1000),
    beachDirect: count((id) => beachOf(id)?.bd === 1),
    beachDistance: count((id) => typeof beachOf(id)?.bm === 'number'),
  };
  table.meta = {
    description: 'Derived ligging table (SUB 27). Result only; absent = unknown. Keys: hotel key (first two id segments); offers[] only where the offers of one hotel disagree on strand.',
    fields: { s: 'GHS-SMOD class (1 km cell)', c: 'OSM coast distance in metres (unknown when coordinates unusable)', bd: 'strand direct', bm: 'strand distance in metres (not direct)' },
    rules: { kust: 'c <= 1000', stedelijk: 'SMOD 30/23/22', landelijk: 'SMOD 13/12/11' },
    sources: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, { file: path.basename(file), sha256: sha256(file) }])),
    smod: {
      product: 'GHS_SMOD_E2020_GLOBE_R2023A_54009_1000_V2_0',
      licence: 'CC BY 4.0 (European Commission, JRC GHSL)',
      coastline: 'OpenStreetMap (ODbL)',
      places: 'GeoNames',
    },
    counts,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(table)}\n`, 'utf8');
  console.log(JSON.stringify(counts, null, 2));
  console.log(`written ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

main();