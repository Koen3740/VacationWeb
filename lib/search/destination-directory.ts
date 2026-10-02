import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import {
  DESTINATION_PARENTS,
  offerAreaLabels,
  normalizePlaceText,
  pickPlaceDisplayName,
  placeGroupKey,
} from '@/lib/search/destination-mapping';
import { isProductDestinationValue } from '@/lib/search/destination-product-names';

/**
 * VacationWeb destination directory (M1): the destinations the Destination popup offers
 * (country / area / place), derived from the catalog by a pure function and stored as a small
 * generated JSON (`destination-directory.json`) so the client-side popup needs no offers.
 * The catalog, R2 and live pricing are untouched; regenerate with
 * `npx tsx scripts/build-destination-directory.ts` after a catalog refresh. A guard test compares
 * the stored file with the local catalog and reports new or removed destinations.
 *
 * Provider independent: only (country, region, province, city) values are read, never the provider.
 */

export type DirectoryOfferInput = {
  country: string;
  region?: string | null;
  province?: string | null;
  city?: string | null;
};

export type DirectoryArea = { c: string; n: string };
/** `a` = short area label, present only for places whose name is shared by several effective destinations. */
export type DirectoryPlace = { c: string; n: string; a?: string };
/** Names that are both an area (region/province label) and a place (city) in one country. */
export type DirectoryBoth = { c: string; n: string; rel: 'eq' | 'split' };

export type DestinationDirectory = {
  version: 1;
  offers: number;
  countries: string[];
  areas: DirectoryArea[];
  places: DirectoryPlace[];
  both: DirectoryBoth[];
};

/**
 * Category 3 (NOT mapped, manual review): place names whose catalog area labels are different
 * descriptions of the SAME or an unresolved area (Costa del Sol vs Andalusie, Parga vs Epirus (Parga),
 * Pieria vs Pieria - Olympus Riviera, Klassieke Kust vs Egeische Kust, Costa de Lisboa vs Lissabon,
 * Azoren vs Madeira data error). They stay ONE entry without area suffix and the filter keeps matching
 * on the place only. Key = `${country}|${placeGroupKey}`. A guard test requires every entry to still
 * occur with more than one area cluster in the catalog (no dead entries).
 */
export const UNRESOLVED_AMBIGUOUS_PLACES: readonly string[] = [
  'Portugal|lissabon',
  'Turkije|icmeler',
  'Turkije|ozdere',
  'Turkije|seferihisar',
  'Turkije|gumuldur',
  'Spanje|torremolinos',
  'Spanje|marbella',
  'Spanje|malaga',
  'Spanje|benalmadena',
  'Griekenland|parga',
  'Griekenland|platamonas',
  'Griekenland|olympiaki akti',
  'Griekenland|vrachos',
  'Griekenland|kanali',
  'Griekenland|litochoro',
  'Griekenland|preveza',
  'Portugal|ponta delgada',
];

type Cluster = { labels: Map<string, number>; offers: number };

/**
 * A collective label (Balearen, Canarische Eilanden) must not glue the clusters of its islands together,
 * and an offer that only carries the collective label (the 2 Iles Canaries-only offers) must not create
 * a fake homonym: it contributes no cluster and stays findable through the place / collective destination.
 */
function clusterLabelsOf(labels: string[]): string[] {
  return labels.filter((label) => !(label in DESTINATION_PARENTS));
}

function clusterByLabels(labelSets: string[][]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const labels of labelSets) {
    if (labels.length === 0) {
      continue;
    }
    const hits = clusters.filter((cluster) => labels.some((label) => cluster.labels.has(label)));
    const target = hits[0] ?? { labels: new Map<string, number>(), offers: 0 };
    if (!hits[0]) {
      clusters.push(target);
    }
    for (const other of hits.slice(1)) {
      for (const [label, count] of other.labels) {
        target.labels.set(label, (target.labels.get(label) ?? 0) + count);
      }
      target.offers += other.offers;
      clusters.splice(clusters.indexOf(other), 1);
    }
    for (const label of labels) {
      target.labels.set(label, (target.labels.get(label) ?? 0) + 1);
    }
    target.offers += 1;
  }
  return clusters;
}

function clusterAreaLabel(cluster: Cluster, placeKey: string): string {
  const candidates = [...cluster.labels.entries()].filter(
    ([label]) => normalizePlaceText(label) !== placeKey,
  );
  const pool = candidates.length > 0 ? candidates : [...cluster.labels.entries()];
  const withoutParents = pool.filter(([label]) => !(label in DESTINATION_PARENTS));
  const ranked = (withoutParents.length > 0 ? withoutParents : pool).sort(
    (left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1),
  );
  return ranked[0]?.[0] ?? '';
}

const byName = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export function buildDestinationDirectory(offers: readonly DirectoryOfferInput[]): DestinationDirectory {
  const countriesWithRealOffer = new Set<string>();
  // country -> mechanical area key -> { label, real offers }
  const areaMap = new Map<string, Map<string, { label: string; real: number; offerIdx: Set<number> }>>();
  // country -> place group key -> { variants, labelSets, offerIdx }
  const placeMap = new Map<
    string,
    Map<string, { variants: Set<string>; labelSets: string[][]; offerIdx: Set<number>; real: number }>
  >();

  offers.forEach((offer, index) => {
    const country = canonicalizeCountryName(offer.country);
    if (!country) {
      return;
    }
    const regionRaw = offer.region?.trim() || '';
    const provinceRaw = offer.province?.trim() || '';
    const cityRaw = offer.city?.trim() || '';
    const regionProduct = Boolean(regionRaw) && isProductDestinationValue(country, 'region', regionRaw);
    const provinceProduct = Boolean(provinceRaw) && isProductDestinationValue(country, 'province', provinceRaw);
    const cityProduct = Boolean(cityRaw) && isProductDestinationValue(country, 'city', cityRaw);
    const isProductOffer = regionProduct || provinceProduct || cityProduct;
    if (!isProductOffer) {
      countriesWithRealOffer.add(country);
    }

    const labels = offerAreaLabels(
      regionProduct ? undefined : regionRaw,
      provinceProduct ? undefined : provinceRaw,
    ).filter((label) => normalizePlaceText(label) !== normalizePlaceText(country));

    const areas = areaMap.get(country) ?? new Map();
    areaMap.set(country, areas);
    for (const label of labels) {
      const key = normalizePlaceText(label);
      const entry = areas.get(key) ?? { label, real: 0, offerIdx: new Set<number>() };
      entry.offerIdx.add(index);
      if (!isProductOffer) {
        entry.real += 1;
      }
      if (label < entry.label) {
        entry.label = label;
      }
      areas.set(key, entry);
    }

    if (cityRaw && !cityProduct) {
      const places = placeMap.get(country) ?? new Map();
      placeMap.set(country, places);
      const key = placeGroupKey(cityRaw);
      const entry = places.get(key) ?? {
        variants: new Set<string>(),
        labelSets: [],
        offerIdx: new Set<number>(),
        real: 0,
      };
      entry.variants.add(cityRaw);
      entry.labelSets.push(clusterLabelsOf(labels));
      entry.offerIdx.add(index);
      if (!isProductOffer) {
        entry.real += 1;
      }
      places.set(key, entry);
    }
  });

  const countries = [...countriesWithRealOffer].sort(byName);

  const areas: DirectoryArea[] = [];
  const areaIdxByKey = new Map<string, Set<number>>();
  for (const country of countries) {
    for (const [key, entry] of areaMap.get(country) ?? []) {
      if (entry.real > 0) {
        areas.push({ c: country, n: entry.label });
        areaIdxByKey.set(`${country}|${key}`, entry.offerIdx);
      }
    }
  }

  // place groups (with cluster analysis)
  type Draft = { c: string; n: string; a?: string; key: string; real: number };
  const drafts: Draft[] = [];
  for (const country of countries) {
    for (const [key, entry] of placeMap.get(country) ?? []) {
      if (entry.real === 0) {
        continue;
      }
      const clusters = clusterByLabels(entry.labelSets);
      const unresolved = UNRESOLVED_AMBIGUOUS_PLACES.includes(`${country}|${key}`);
      if (clusters.length > 1 && !unresolved) {
        for (const cluster of clusters) {
          drafts.push({
            c: country,
            n: pickPlaceDisplayName([...entry.variants]),
            a: clusterAreaLabel(cluster, key),
            key,
            real: cluster.offers,
          });
        }
      } else {
        drafts.push({ c: country, n: pickPlaceDisplayName([...entry.variants]), key, real: entry.real });
      }
    }
  }

  // same place name in several countries (e.g. Petra): short area suffix on each, from its cluster
  const draftsByKey = new Map<string, Draft[]>();
  for (const draft of drafts) {
    draftsByKey.set(draft.key, [...(draftsByKey.get(draft.key) ?? []), draft]);
  }
  for (const group of draftsByKey.values()) {
    const countryCount = new Set(group.map((draft) => draft.c)).size;
    if (countryCount > 1) {
      for (const draft of group) {
        if (!draft.a) {
          const entry = placeMap.get(draft.c)?.get(draft.key);
          const clusters = entry ? clusterByLabels(entry.labelSets) : [];
          draft.a = clusters[0] ? clusterAreaLabel(clusters[0], draft.key) : '';
        }
      }
    }
  }

  const places: DirectoryPlace[] = drafts
    .map((draft) => ({ c: draft.c, n: draft.n, ...(draft.a ? { a: draft.a } : {}) }))
    .sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n) || byName(left.a ?? '', right.a ?? ''));

  // names that are both an area and a place
  const both: DirectoryBoth[] = [];
  for (const area of areas) {
    const key = normalizePlaceText(area.n);
    const placeEntry = placeMap.get(area.c)?.get(key);
    if (!placeEntry || placeEntry.real === 0) {
      continue;
    }
    const areaIdx = areaIdxByKey.get(`${area.c}|${key}`) ?? new Set<number>();
    const equal =
      areaIdx.size === placeEntry.offerIdx.size && [...areaIdx].every((idx) => placeEntry.offerIdx.has(idx));
    both.push({ c: area.c, n: area.n, rel: equal ? 'eq' : 'split' });
  }

  areas.sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n));
  both.sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n));

  return { version: 1, offers: offers.length, countries, areas, places, both };
}

export type DestinationEntryKind = 'country' | 'region' | 'city';

/** One selectable destination of the popup (what the user picks and what the URL will carry). */
export type DestinationEntry = {
  kind: DestinationEntryKind;
  country: string;
  /** User-facing name (HTML entities decoded). */
  name: string;
  /** Short disambiguation shown after the name (only for homonyms: "stad" / "regio" / area). */
  suffix?: string;
  /** URL values (existing contract): country, optional region, optional city. */
  region?: string;
  city?: string;
};

export function entryLabel(entry: Pick<DestinationEntry, 'name' | 'suffix'>): string {
  return entry.suffix ? `${entry.name} \u2014 ${entry.suffix}` : entry.name;
}

/** Directory -> popup entries (countries, areas, places) with short suffixes only for homonyms. */
export function buildDestinationEntries(directory: DestinationDirectory): DestinationEntry[] {
  const bothMap = new Map(directory.both.map((entry) => [`${entry.c}|${normalizePlaceText(entry.n)}`, entry.rel]));
  const entries: DestinationEntry[] = [];

  for (const country of directory.countries) {
    entries.push({ kind: 'country', country, name: country });
  }
  for (const area of directory.areas) {
    const rel = bothMap.get(`${area.c}|${normalizePlaceText(area.n)}`);
    entries.push({
      kind: 'region',
      country: area.c,
      name: area.n,
      ...(rel === 'split' ? { suffix: 'regio' } : {}),
      region: area.n,
    });
  }
  for (const place of directory.places) {
    const rel = bothMap.get(`${place.c}|${placeGroupKey(place.n)}`);
    if (rel === 'eq') {
      continue;
    }
    entries.push({
      kind: 'city',
      country: place.c,
      name: place.n,
      ...(rel === 'split' ? { suffix: 'stad' } : place.a ? { suffix: place.a } : {}),
      ...(place.a && rel !== 'split' ? { region: place.a } : {}),
      city: place.n,
    });
  }
  return entries;
}

/** Sidebar / legacy form lists derived from the same directory (one spelling per destination). */
export function destinationListsByCountry(directory: DestinationDirectory): {
  regionsByCountry: Record<string, string[]>;
  citiesByCountry: Record<string, string[]>;
} {
  const regionsByCountry: Record<string, string[]> = {};
  const citiesByCountry: Record<string, string[]> = {};
  for (const area of directory.areas) {
    (regionsByCountry[area.c] ??= []).push(area.n);
  }
  for (const place of directory.places) {
    const list = (citiesByCountry[place.c] ??= []);
    if (!list.includes(place.n)) {
      list.push(place.n);
    }
  }
  for (const record of [regionsByCountry, citiesByCountry]) {
    for (const country of Object.keys(record)) {
      record[country] = [...new Set(record[country])].sort((left, right) => left.localeCompare(right, 'nl'));
    }
  }
  return { regionsByCountry, citiesByCountry };
}
