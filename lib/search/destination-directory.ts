import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import {
  DESTINATION_PARENTS,
  basePlaceGroupKey,
  decodePlaceName,
  offerAreaLabels,
  normalizePlaceText,
  pickBasePlaceDisplayName,
  placeGroupKey,
  splitCompositePlace,
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
/**
 * `a` = short disambiguation label, present only for places whose name is shared by several effective
 * destinations. `p` = parent of a provider composite name ("Chania" for "Chania - Agia Marina"): search
 * text only, never shown. `v` = URL city value, only for a composite that must stay its own destination
 * ("Chania - Kalamaki" next to the other Kalamaki places).
 */
export type DirectoryPlace = { c: string; n: string; a?: string; p?: string; v?: string };
/** Provider composite city value (as in the catalog) -> the place it names (merged into that place). */
export type DirectoryComposite = { c: string; n: string; p: string };
/** Names that are both an area (region/province label) and a place (city) in one country. */
export type DirectoryBoth = { c: string; n: string; rel: 'eq' | 'split' };

export type DestinationDirectory = {
  version: 1;
  offers: number;
  countries: string[];
  areas: DirectoryArea[];
  places: DirectoryPlace[];
  both: DirectoryBoth[];
  composites: DirectoryComposite[];
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

/**
 * Provider composite names whose direction cannot be proven from the catalog (no repeated side, so
 * `resolveComposites` leaves them as they are). Display only (t334u, owner rule: the name the user
 * searches on comes FIRST, the context LAST, never a "Regio - Plaats" prefix): the URL value
 * (city / region) stays the raw catalog string, so the URL contract and the Results filter do not
 * change. Key = `${country}|${raw catalog value}`. Name-first direction is a product choice: the more
 * specific part is the name, the wider part is the context (and is searchable as parent).
 */
export const COMPOSITE_DISPLAY: Readonly<Record<string, { name: string; suffix: string }>> = {
  'Portugal|Sao Miquel - Caloura': { name: 'Caloura', suffix: 'Sao Miguel' },
  'Spanje|Marbella - San Pedro': { name: 'San Pedro', suffix: 'Marbella' },
  'Turkije|Bodrum - Guvercinlik': { name: 'Guvercinlik', suffix: 'Bodrum' },
  'Griekenland|Ouranoupoli - Athos': { name: 'Ouranoupoli', suffix: 'Athos' },
  'Griekenland|Pieria - Olympus Riviera': { name: 'Olympus Riviera', suffix: 'Pieria' },
};

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

type CompositeInfo = { raw: string; place: string; parent: string };

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Provider composite city values ("A - B") per country. The side that is repeated by at least two
 * different composites is the parent (Chania x14, Ierapetra x3, Kassandra x8, Sithonia x2, Sao Miguel x4);
 * the other side is the place. A composite with no repeated side, or with both sides repeated, is NOT
 * resolved (the direction cannot be proven from the catalog) and stays as it is.
 * Key = `${country}|${normalizePlaceText(raw)}` (so an unhyphenated spelling of the same text matches too).
 */
function resolveComposites(cities: ReadonlyArray<{ country: string; city: string }>): Map<string, CompositeInfo> {
  const distinct = new Map<string, Map<string, { raw: string; head: string; tail: string }>>();
  for (const { country, city } of cities) {
    const parts = splitCompositePlace(city);
    if (!parts) {
      continue;
    }
    const perCountry = distinct.get(country) ?? new Map();
    distinct.set(country, perCountry);
    const key = normalizePlaceText(city);
    if (!perCountry.has(key)) {
      perCountry.set(key, { raw: decodePlaceName(city), ...parts });
    }
  }
  const resolved = new Map<string, CompositeInfo>();
  for (const [country, composites] of distinct) {
    const heads = new Map<string, number>();
    const tails = new Map<string, number>();
    for (const composite of composites.values()) {
      bump(heads, normalizePlaceText(composite.head));
      bump(tails, normalizePlaceText(composite.tail));
    }
    for (const [key, composite] of composites) {
      const headRepeated = (heads.get(normalizePlaceText(composite.head)) ?? 0) >= 2;
      const tailRepeated = (tails.get(normalizePlaceText(composite.tail)) ?? 0) >= 2;
      if (headRepeated === tailRepeated) {
        continue;
      }
      resolved.set(
        `${country}|${key}`,
        headRepeated
          ? { raw: composite.raw, place: composite.tail, parent: composite.head }
          : { raw: composite.raw, place: composite.head, parent: composite.tail },
      );
    }
  }
  return resolved;
}

type PlaceEntry = {
  variants: Set<string>;
  labelSets: string[][];
  /** Parent of the composite behind each label set (undefined for a plain place name). */
  parents: Array<string | undefined>;
  offerIdx: Set<number>;
  real: number;
};

function mostFrequent(values: ReadonlyArray<string | undefined>): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) {
      bump(counts, value);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || byName(left[0], right[0]))[0]?.[0];
}

/** Parent is search text only: leave it out when it just repeats the place or the shown area label. */
function usefulParent(parent: string | undefined, name: string, areaLabel: string | undefined): string | undefined {
  if (!parent) {
    return undefined;
  }
  const key = normalizePlaceText(parent);
  return key === normalizePlaceText(name) || key === normalizePlaceText(areaLabel ?? '') ? undefined : parent;
}

export function buildDestinationDirectory(offers: readonly DirectoryOfferInput[]): DestinationDirectory {
  const countriesWithRealOffer = new Set<string>();
  // country -> mechanical area key -> { label, real offers }
  const areaMap = new Map<string, Map<string, { label: string; real: number; offerIdx: Set<number> }>>();
  // country -> place group key -> { variants, labelSets, offerIdx }
  const placeMap = new Map<string, Map<string, PlaceEntry>>();
  // country -> normalized composite value -> its offers (resolved composites only)
  const compositeMap = new Map<
    string,
    Map<string, { info: CompositeInfo; labelSets: string[][]; offerIdx: Set<number>; real: number }>
  >();

  const compositeCandidates: Array<{ country: string; city: string }> = [];
  for (const offer of offers) {
    const country = canonicalizeCountryName(offer.country);
    const cityRaw = offer.city?.trim() || '';
    if (country && cityRaw && !isProductDestinationValue(country, 'city', cityRaw)) {
      compositeCandidates.push({ country, city: cityRaw });
    }
  }
  const resolvedComposites = resolveComposites(compositeCandidates);

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
      const info = resolvedComposites.get(`${country}|${normalizePlaceText(cityRaw)}`);
      if (info) {
        const composites = compositeMap.get(country) ?? new Map();
        compositeMap.set(country, composites);
        const compositeKey = normalizePlaceText(cityRaw);
        const entry = composites.get(compositeKey) ?? { info, labelSets: [], offerIdx: new Set<number>(), real: 0 };
        entry.labelSets.push(clusterLabelsOf(labels));
        entry.offerIdx.add(index);
        if (!isProductOffer) {
          entry.real += 1;
        }
        composites.set(compositeKey, entry);
        return;
      }
      const places = placeMap.get(country) ?? new Map();
      placeMap.set(country, places);
      const key = basePlaceGroupKey(cityRaw);
      const entry: PlaceEntry = places.get(key) ?? {
        variants: new Set<string>(),
        labelSets: [],
        parents: [],
        offerIdx: new Set<number>(),
        real: 0,
      };
      entry.variants.add(cityRaw);
      entry.labelSets.push(clusterLabelsOf(labels));
      entry.parents.push(undefined);
      entry.offerIdx.add(index);
      if (!isProductOffer) {
        entry.real += 1;
      }
      places.set(key, entry);
    }
  });

  // Resolved composites: merge into the place they name, unless that place name is already a homonym in
  // the country (several clusters) and the composite lies in one of them - then it cannot be proven to be
  // the same place, so it stays its own destination (own URL city value, parent as label).
  type SeparateComposite = { c: string; n: string; a: string; v: string; real: number };
  const separateComposites: SeparateComposite[] = [];
  const mergedComposites: DirectoryComposite[] = [];
  const mergedInto: Array<{ country: string; key: string; composite: DirectoryComposite }> = [];
  for (const [country, composites] of compositeMap) {
    const places = placeMap.get(country) ?? new Map<string, PlaceEntry>();
    placeMap.set(country, places);
    const standaloneClusters = new Map<string, Cluster[]>();
    for (const composite of composites.values()) {
      const key = basePlaceGroupKey(composite.info.place);
      if (!standaloneClusters.has(key)) {
        const standalone = places.get(key);
        standaloneClusters.set(key, standalone ? clusterByLabels(standalone.labelSets) : []);
      }
    }
    const decisions: Array<{ composite: (typeof composites extends Map<string, infer V> ? V : never); key: string; separate: boolean }> = [];
    for (const composite of composites.values()) {
      const key = basePlaceGroupKey(composite.info.place);
      const clusters = standaloneClusters.get(key) ?? [];
      const labels = new Set(composite.labelSets.flat());
      const overlaps = clusters.some((cluster) => [...labels].some((label) => cluster.labels.has(label)));
      const separate = clusters.length >= 2 && overlaps && !UNRESOLVED_AMBIGUOUS_PLACES.includes(`${country}|${key}`);
      decisions.push({ composite, key, separate });
    }
    for (const { composite, key, separate } of decisions) {
      if (composite.real === 0) {
        continue;
      }
      if (separate) {
        separateComposites.push({
          c: country,
          n: pickBasePlaceDisplayName([composite.info.place]),
          a: composite.info.parent,
          v: composite.info.raw,
          real: composite.real,
        });
        continue;
      }
      const entry: PlaceEntry = places.get(key) ?? {
        variants: new Set<string>(),
        labelSets: [],
        parents: [],
        offerIdx: new Set<number>(),
        real: 0,
      };
      entry.variants.add(composite.info.place);
      for (const labelSet of composite.labelSets) {
        entry.labelSets.push(labelSet);
        entry.parents.push(composite.info.parent);
      }
      composite.offerIdx.forEach((idx) => entry.offerIdx.add(idx));
      entry.real += composite.real;
      places.set(key, entry);
      mergedInto.push({ country, key, composite: { c: country, n: composite.info.raw, p: composite.info.place } });
    }
  }
  for (const { country, key, composite } of mergedInto) {
    const entry = placeMap.get(country)?.get(key);
    mergedComposites.push({ ...composite, p: entry ? pickBasePlaceDisplayName([...entry.variants]) : composite.p });
  }

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
  type Draft = { c: string; n: string; a?: string; p?: string; v?: string; key: string; real: number };
  const drafts: Draft[] = [];
  for (const country of countries) {
    for (const [key, entry] of placeMap.get(country) ?? []) {
      if (entry.real === 0) {
        continue;
      }
      const clusters = clusterByLabels(entry.labelSets);
      const unresolved = UNRESOLVED_AMBIGUOUS_PLACES.includes(`${country}|${key}`);
      const name = pickBasePlaceDisplayName([...entry.variants]);
      if (clusters.length > 1 && !unresolved) {
        for (const cluster of clusters) {
          const area = clusterAreaLabel(cluster, key);
          const inCluster = entry.parents.filter((_, i) => entry.labelSets[i].some((label) => cluster.labels.has(label)));
          drafts.push({
            c: country,
            n: name,
            a: area,
            p: usefulParent(mostFrequent(inCluster), name, area),
            key,
            real: cluster.offers,
          });
        }
      } else {
        drafts.push({ c: country, n: name, p: usefulParent(mostFrequent(entry.parents), name, undefined), key, real: entry.real });
      }
    }
  }
  for (const separate of separateComposites) {
    if (countries.includes(separate.c)) {
      drafts.push({ c: separate.c, n: separate.n, a: separate.a, v: separate.v, key: `composite|${normalizePlaceText(separate.v)}`, real: separate.real });
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
    .map((draft) => ({
      c: draft.c,
      n: draft.n,
      ...(draft.a ? { a: draft.a } : {}),
      ...(draft.p ? { p: draft.p } : {}),
      ...(draft.v ? { v: draft.v } : {}),
    }))
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

  const composites = mergedComposites
    .filter((composite) => countries.includes(composite.c))
    .sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n));
  areas.sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n));
  both.sort((left, right) => byName(left.c, right.c) || byName(left.n, right.n));

  return { version: 1, offers: offers.length, countries, areas, places, both, composites };
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
  /** Parent of a provider composite name: search text only, never shown. */
  parent?: string;
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
    const display = COMPOSITE_DISPLAY[`${area.c}|${area.n}`];
    entries.push({
      kind: 'region',
      country: area.c,
      name: display?.name ?? area.n,
      ...(display
        ? { suffix: display.suffix, parent: display.suffix }
        : rel === 'split'
          ? { suffix: 'regio' }
          : {}),
      region: area.n,
    });
  }
  for (const place of directory.places) {
    const rel = bothMap.get(`${place.c}|${placeGroupKey(place.n)}`);
    if (rel === 'eq') {
      continue;
    }
    const display = COMPOSITE_DISPLAY[`${place.c}|${place.v ?? place.n}`];
    entries.push({
      kind: 'city',
      country: place.c,
      name: display?.name ?? place.n,
      ...(display
        ? { suffix: display.suffix }
        : rel === 'split'
          ? { suffix: 'stad' }
          : place.a
            ? { suffix: place.a }
            : {}),
      ...(place.a && rel !== 'split' && !place.v ? { region: place.a } : {}),
      city: place.v ?? place.n,
      ...(display ? { parent: display.suffix } : place.p ? { parent: place.p } : {}),
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
    const value = place.v ?? place.n;
    if (!list.includes(value)) {
      list.push(value);
    }
  }
  for (const record of [regionsByCountry, citiesByCountry]) {
    for (const country of Object.keys(record)) {
      record[country] = [...new Set(record[country])].sort((left, right) => left.localeCompare(right, 'nl'));
    }
  }
  return { regionsByCountry, citiesByCountry };
}
