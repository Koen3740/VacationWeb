/**
 * P10 — Albanië Active Experience Set + chapter story (editorial, fixed).
 * Pool remains audit SSOT; visitor sees only this curated set (no random append).
 */
import { ensureVerifiedWebPath } from '../destination-media/ensure-verified-web-path';
import { listFinalVerifiedUsableAssets } from '../destination-media/list-final-verified-usable';
import { loadDestinationMediaPool } from '../destination-media/load-destination-media-pool';
import type { DestinationMediaPoolAsset } from '../destination-media/types';
import { buildDiscoverResultsHref } from './discover-destination-href';
import { destinationPlaceLabel } from './destination-place-labels';
import { getDiscoverDestinationById } from './discover-pool';
import type { DiscoverDestination } from './types';

export const ALBANIA_DESTINATION_ID = 'albania' as const;

/** Fixed Active Experience Set — quality over rotation. */
export const ALBANIA_ACTIVE_EXPERIENCE = {
  teaserPreferred: 'vw-story-albania-blue-eye-crop-p5',
  hero: 'vw-story-albania-ksamil-bay-crop-p5',
  rivieraAnchor: 'vw-story-albania-dhermi-framed-33396275',
  rivieraPlace: 'vw-pool-albania-himara',
  rivieraBeat: 'vw-pool-albania-llogara',
  citiesEstablishing: 'vw-story-albania-gjirokaster-cityscape-pudelek-fp',
  citiesSecond: 'vw-pool-albania-berat-unesco-2016',
  alpsScale: 'vw-pool-albania-theth-national-park-2017',
  wowInterrupt: 'vw-pool-albania-lake-koman',
  wowFallback: 'vw-story-albania-blue-eye-commons',
} as const;

export type AlbaniaMediaSlot = {
  assetId: string;
  src: string;
  placeId?: string;
  placeLabel: string;
  role: string;
};

export type AlbaniaChapterBlock = {
  id: string;
  title: string;
  lead: string;
  layout: 'image-left' | 'image-right' | 'stack';
  media: AlbaniaMediaSlot[];
  contextualBridgeLabel?: string;
};

export type AlbaniaExperienceModel = {
  destination: DiscoverDestination;
  heroSrc: string;
  heroAssetId: string;
  essence: string;
  why: readonly string[];
  chapters: AlbaniaChapterBlock[];
  wow: AlbaniaMediaSlot | null;
  wowCaption: string;
  desire: {
    title: string;
    body: string;
    media: AlbaniaMediaSlot | null;
  };
  practical: { title: string; items: readonly string[] };
  budget: { title: string; body: string };
  resultsHref: string;
  earlyBridgeLabel: string;
  finalBridgeLabel: string;
};

function finalsById(): Map<string, DestinationMediaPoolAsset> {
  const pool = loadDestinationMediaPool(ALBANIA_DESTINATION_ID);
  const finals = pool ? listFinalVerifiedUsableAssets(pool) : [];
  return new Map(finals.map((a) => [a.assetId, a]));
}

function resolveSlot(
  byId: Map<string, DestinationMediaPoolAsset>,
  assetId: string,
  role: string,
  excludeIds: ReadonlySet<string>,
): AlbaniaMediaSlot | null {
  if (excludeIds.has(assetId)) return null;
  const asset = byId.get(assetId);
  if (!asset) return null;
  const src = ensureVerifiedWebPath(asset);
  if (!src) return null;
  return {
    assetId,
    src,
    placeId: asset.placeId,
    placeLabel: destinationPlaceLabel(asset.placeId),
    role,
  };
}

function firstAvailable(
  byId: Map<string, DestinationMediaPoolAsset>,
  ids: readonly string[],
  role: string,
  excludeIds: ReadonlySet<string>,
): AlbaniaMediaSlot | null {
  for (const id of ids) {
    const slot = resolveSlot(byId, id, role, excludeIds);
    if (slot) return slot;
  }
  return null;
}

/**
 * Build Albania C2 experience model. Returns null if destination missing.
 * Never invents media; never auto-fills with weak pool rest.
 */
export function buildAlbaniaExperienceModel(): AlbaniaExperienceModel | null {
  const destination = getDiscoverDestinationById(ALBANIA_DESTINATION_ID);
  if (!destination) return null;

  const byId = finalsById();
  const heroId = ALBANIA_ACTIVE_EXPERIENCE.hero;
  const exclude = new Set<string>([heroId]);

  const hero =
    resolveSlot(byId, heroId, 'hero-scale', new Set()) ??
    firstAvailable(
      byId,
      [
        'vw-pool-albania-theth-national-park-2017',
        'vw-story-albania-blue-eye-crop-p5',
      ],
      'hero-scale',
      new Set(),
    );

  if (!hero) return null;
  exclude.add(hero.assetId);

  const rivieraMedia = [
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.rivieraAnchor, 'anchor-place', exclude),
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.rivieraPlace, 'place', exclude),
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.rivieraBeat, 'detail', exclude),
  ].filter((m): m is AlbaniaMediaSlot => Boolean(m));

  const citiesMedia = [
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.citiesEstablishing, 'establishing', exclude),
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.citiesSecond, 'place', exclude),
  ].filter((m): m is AlbaniaMediaSlot => Boolean(m));

  const alpsMedia = [
    resolveSlot(byId, ALBANIA_ACTIVE_EXPERIENCE.alpsScale, 'scale-desire', exclude),
  ].filter((m): m is AlbaniaMediaSlot => Boolean(m));

  const wow = firstAvailable(
    byId,
    [ALBANIA_ACTIVE_EXPERIENCE.wowInterrupt, ALBANIA_ACTIVE_EXPERIENCE.wowFallback],
    'wow-interrupt',
    exclude,
  );

  const resultsHref = buildDiscoverResultsHref(ALBANIA_DESTINATION_ID);

  return {
    destination,
    heroSrc: hero.src,
    heroAssetId: hero.assetId,
    essence: 'Ionische kust én Alpen — dichterbij dan je denkt.',
    why: [
      'Baaien, bergen en steensteden in één reis',
      'UNESCO-steden met echte schaal: Gjirokastër en Berat',
      'WOW-natuur naast een roadtripbare Riviera',
    ] as const,
    chapters: [
      {
        id: 'riviera',
        title: 'Albanese Riviera',
        lead: 'Van groene hellingen naar helder Ionisch water. Dhërmi, Himarë en de weg over Llogara maken de kust tot een reis op zich.',
        layout: 'image-left',
        media: rivieraMedia,
        contextualBridgeLabel: 'Kustvakanties naar Albanië vergelijken',
      },
      {
        id: 'steden',
        title: 'Historische steden',
        lead: 'Leien daken in Gjirokastër, duizend ramen in Berat — steden die je niet als “stopje” bezoekt, maar als hoofdstuk.',
        layout: 'image-right',
        media: citiesMedia,
      },
      {
        id: 'alpen',
        title: 'Albanese Alpen',
        lead: 'In Theth voelt Albanië ineens als hooggebergte: vallei, pieken, stilte. Het andere gezicht van hetzelfde land.',
        layout: 'stack',
        media: alpsMedia,
      },
    ],
    wow,
    wowCaption: 'En dan dit — een moment dat je nergens anders zo tegenkomt.',
    desire: {
      title: 'Hier zou je wel naartoe willen',
      body: 'Niet omdat het trending is, maar omdat de plekken concreet worden: zwemmen in helder water, slapen bij steensteden, wandelen in de Alpen. Daarna is de natuurlijke vraag: wat zou een vakantie hier kosten?',
      media: null,
    },
    practical: {
      title: 'Praktisch, kort',
      items: [
        'Roadtrip-vriendelijk — reken op meer reistijd dan de kaart suggereert',
        'Fijnste balans vaak in voor- of naseizoen (minder druk, nog warm genoeg)',
        'Reken op zo’n week tot tien dagen om kust én binnenland te proeven',
      ] as const,
    },
    budget: {
      title: 'Budget',
      body: 'Albanië is vaak scherper geprijsd dan bekendere Middelandse-Zee-bestemmingen. Wat het écht kost, zie je pas als je vakanties vergelijkt — geen catalogusprijs hier.',
    },
    resultsHref,
    earlyBridgeLabel: 'Bekijk wat er aan vakanties is',
    finalBridgeLabel: `Vergelijk vakanties naar ${destination.name}`,
  };
}
