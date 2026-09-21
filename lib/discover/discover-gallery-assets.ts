/**
 * P7 visitor gallery curation — STABLE WOW-only selection.
 * Pool stays audit SSOT. Visible gallery NEVER auto-appends remaining finals.
 * Hero asset must be excluded by caller (excludeAssetIds / excludeMasterPaths).
 */
export const DISCOVER_GALLERY_ASSET_IDS: Readonly<Record<string, readonly string[]>> = {
  albania: [
    'vw-story-albania-blue-eye-crop-p5',
    'vw-story-albania-gjirokaster-clock-tower-pudelek5',
    'vw-pool-albania-berat-unesco-2016',
    'vw-pool-albania-theth-national-park-2017',
    'vw-pool-albania-lake-koman',
    'vw-story-albania-dhermi-framed-33396275',
  ],
  sicily: [
    'vw-story-sicily-taormina-teatro-etna-commons',
    'vw-story-sicily-cefalu-view-0832-commons',
    'vw-story-sicily-concordia-temple-37261506',
    'vw-story-sicily-concordia-valle-2024-commons',
    'vw-story-sicily-isola-bella-37105275',
    'vw-pool-sicily-ortigia',
  ],
  crete: [
    'vw-story-crete-elafonissi-water-15071869',
    'vw-story-crete-knossos-palace-commons',
    'vw-story-crete-preveli-aerial-commons',
    'vw-story-crete-vai-beach-commons',
    'vw-story-crete-samaria-dominou-1',
    'vw-pool-crete-falassarna',
  ],
  sardinia: [
    'vw-story-sardinia-tavolara-18660972',
    'vw-story-sardinia-cala-goloritze-aguglia-commons',
    'vw-story-sardinia-nuraghe-su-nuraxi-19',
    'vw-pool-sardinia-la-pelosa',
    'vw-story-sardinia-piscinas-dunes-arbus10',
    'vw-pool-sardinia-cala-luna',
  ],
};

export function curateDiscoverGallery<T extends { assetId: string; masterPath?: string; src?: string }>(
  destinationId: string,
  items: readonly T[],
  options: { excludeAssetIds?: readonly string[]; excludeMasterPaths?: readonly string[] } = {},
): T[] {
  const preferred = DISCOVER_GALLERY_ASSET_IDS[destinationId];
  const excludeIds = new Set(options.excludeAssetIds ?? []);
  const excludePaths = new Set(
    (options.excludeMasterPaths ?? []).map((p) => p.replace(/\\/g, '/').toLowerCase()),
  );

  const filtered = items.filter((item) => {
    if (excludeIds.has(item.assetId)) return false;
    const mp = (item.masterPath ?? '').replace(/\\/g, '/').toLowerCase();
    if (mp && excludePaths.has(mp)) return false;
    const src = (item.src ?? '').replace(/\\/g, '/').toLowerCase();
    for (const ex of excludePaths) {
      const base = ex.split('/').pop();
      if (base && src.endsWith(base)) return false;
    }
    return true;
  });

  // P7: ONLY the explicit curated list — never append remaining pool finals.
  if (!preferred) return [];
  const byId = new Map(filtered.map((item) => [item.assetId, item] as const));
  return preferred
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item));
}