import type { DestinationMediaPoolAsset } from './types';
import { listFinalVerifiedUsableAssets } from './list-final-verified-usable';
import { loadDestinationMediaPool } from './load-destination-media-pool';
import type { ListFinalOptions } from './list-final-verified-usable';

/**
 * Homepage Discover/inspiratie teasers (P6) — commercial WOW cards.
 * May differ from destination-page heroes. Sicily Scala + Crete Balos = WOW benchmarks.
 * Variety: spring / cliffs / lagoon / limestone pinnacle (not four beaches).
 */
export const PREFERRED_DISCOVER_TEASER_ASSET_IDS: Readonly<
  Record<string, readonly string[]>
> = {
  albania: [
    'vw-story-albania-blue-eye-crop-p5',
    'vw-story-albania-gjirokaster-clock-tower-pudelek5',
    'vw-story-albania-ksamil-bay-crop-p5',
  ],
  crete: [
    'vw-story-crete-preveli-aerial-commons',
    'vw-story-crete-balos-aerial-commons',
    'vw-story-crete-elafonissi-water-15071869',
  ],
  sicily: [
    'vw-story-sicily-isola-bella-37105275',
    'vw-pool-sicily-scala-dei-turchi',
    'vw-story-sicily-taormina-teatro-etna-commons',
  ],
  sardinia: [
    'vw-story-sardinia-cala-goloritze-aguglia-commons',
    'vw-story-sardinia-tavolara-18660972',
    'vw-story-sardinia-porto-pino-35142345',
  ],
};

/**
 * Destination /ontdekt/[id] page heroes (P6). Separate from Discover teasers.
 */
export const PREFERRED_DESTINATION_HERO_ASSET_IDS: Readonly<
  Record<string, readonly string[]>
> = {
  albania: [
    'vw-story-albania-ksamil-bay-crop-p5',
    'vw-story-albania-blue-eye-crop-p5',
    'vw-pool-albania-theth-national-park-2017',
  ],
  crete: [
    'vw-story-crete-chania-shipyards-lighthouse-qi',
    'vw-story-crete-preveli-aerial-commons',
    'vw-story-crete-knossos-palace-commons',
  ],
  sicily: [
    'vw-story-sicily-taormina-teatro-etna-commons',
    'vw-story-sicily-cefalu-view-0832-commons',
    'vw-pool-sicily-scala-dei-turchi',
  ],
  sardinia: [
    'vw-story-sardinia-tavolara-18660972',
    'vw-story-sardinia-porto-pino-35142345',
    'vw-story-sardinia-cala-goloritze-aguglia-commons',
  ],
};

const STORY_SCORE_KEYWORDS = [
  'establishing',
  'harbour',
  'harbor',
  'waterfront',
  'cityscape',
  'aerial',
  'coast',
  'emerald',
] as const;

function storyScore(storyElement: string | undefined): number {
  if (!storyElement) return 0;
  const s = storyElement.toLowerCase();
  let score = 0;
  for (const kw of STORY_SCORE_KEYWORDS) {
    if (s.includes(kw)) score += 1;
  }
  return score;
}

function selectPreferredAsset(
  destinationId: string,
  preferredMap: Readonly<Record<string, readonly string[]>>,
  options: ListFinalOptions = {},
): DestinationMediaPoolAsset | null {
  const pool = loadDestinationMediaPool(destinationId, options);
  if (!pool) return null;
  const finals = listFinalVerifiedUsableAssets(pool, options);
  if (finals.length === 0) return null;
  const preferred = preferredMap[destinationId] ?? [];
  for (const id of preferred) {
    const hit = finals.find((a) => a.assetId === id);
    if (hit) return hit;
  }
  const ranked = [...finals].sort((a, b) => {
    const diff = storyScore(b.storyElement) - storyScore(a.storyElement);
    if (diff !== 0) return diff;
    return a.assetId.localeCompare(b.assetId);
  });
  return ranked[0] ?? null;
}

export type SelectDiscoverTeaserOptions = ListFinalOptions & {
  preferredAssetIds?: readonly string[];
};

export function selectDiscoverTeaserAsset(
  destinationId: string,
  options: SelectDiscoverTeaserOptions = {},
): DestinationMediaPoolAsset | null {
  if (options.preferredAssetIds) {
    const pool = loadDestinationMediaPool(destinationId, options);
    if (!pool) return null;
    const finals = listFinalVerifiedUsableAssets(pool, options);
    for (const id of options.preferredAssetIds) {
      const hit = finals.find((a) => a.assetId === id);
      if (hit) return hit;
    }
  }
  return selectPreferredAsset(
    destinationId,
    PREFERRED_DISCOVER_TEASER_ASSET_IDS,
    options,
  );
}

export function selectDestinationHeroAsset(
  destinationId: string,
  options: ListFinalOptions = {},
): DestinationMediaPoolAsset | null {
  return selectPreferredAsset(
    destinationId,
    PREFERRED_DESTINATION_HERO_ASSET_IDS,
    options,
  );
}
