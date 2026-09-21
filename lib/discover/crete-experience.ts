/**
 * P12 — Kreta Active Experience Set + chapter story (editorial, fixed).
 * Avoids Balos/Elafonissi/Chania redundancy; pool FINAL only; no weak fillers.
 */
import { buildDiscoverResultsHref } from './discover-destination-href';
import { getDiscoverDestinationById } from './discover-pool';
import type { DestinationExperienceModel } from './destination-experience-types';
import {
  finalsByDestinationId,
  firstAvailableSlot,
  resolveExperienceSlot,
} from './resolve-experience-media';

export const CRETE_DESTINATION_ID = 'crete' as const;

/** Fixed Active Experience Set — diversity over beach repetition. */
export const CRETE_ACTIVE_EXPERIENCE = {
  teaserPreferred: 'vw-story-crete-preveli-aerial-commons',
  hero: 'vw-story-crete-chania-shipyards-lighthouse-qi',
  westLagoon: 'vw-story-crete-elafonissi-water-15071869',
  westPalmEast: 'vw-story-crete-vai-beach-commons',
  cultureKnossos: 'vw-story-crete-knossos-palace-commons',
  cultureSpinalonga: 'vw-story-crete-spinalonga-ile-qi',
  wildSamaria: 'vw-story-crete-samaria-dominou-1',
  wowInterrupt: 'vw-story-crete-balos-aerial-commons',
} as const;

/** Explicitly not in Active Set (redundant / optional weak breadth). */
export const CRETE_EXCLUDED_FROM_ACTIVE = [
  'vw-pool-crete-falassarna', // optional sunset beach — not needed; avoids beach overload
] as const;

export function buildCreteExperienceModel(): DestinationExperienceModel | null {
  const destination = getDiscoverDestinationById(CRETE_DESTINATION_ID);
  if (!destination) return null;

  const byId = finalsByDestinationId(CRETE_DESTINATION_ID);
  const exclude = new Set<string>();

  const hero =
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.hero, 'hero-scale', exclude) ??
    firstAvailableSlot(
      byId,
      [
        'vw-story-crete-knossos-palace-commons',
        'vw-story-crete-preveli-aerial-commons',
      ],
      'hero-scale',
      exclude,
    );

  if (!hero) return null;
  exclude.add(hero.assetId);

  const westMedia = [
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.westLagoon, 'anchor-place', exclude),
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.westPalmEast, 'place', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const cultureMedia = [
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.cultureKnossos, 'establishing', exclude),
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.cultureSpinalonga, 'place', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const wildMedia = [
    resolveExperienceSlot(byId, CRETE_ACTIVE_EXPERIENCE.wildSamaria, 'scale-desire', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const wow = firstAvailableSlot(
    byId,
    [CRETE_ACTIVE_EXPERIENCE.wowInterrupt],
    'wow-interrupt',
    exclude,
  );
  if (wow) exclude.add(wow.assetId);

  const resultsHref = buildDiscoverResultsHref(CRETE_DESTINATION_ID);

  return {
    destination,
    heroSrc: hero.src,
    heroAssetId: hero.assetId,
    essenceTitle: 'Waarom Kreta',
    essence: 'Lagunes, Minoïsche paleizen en kloven — één eiland, meerdere werelden.',
    why: [
      'Turkooizen lagunes én wilde bergen in één reis',
      'Chania en Knossos: geschiedenis die je kunt aanraken',
      'Niet alleen strand — ook Samaria, Spinalonga, palmenoases',
    ] as const,
    chapters: [
      {
        id: 'westkust',
        title: 'Westkust & lagunes',
        lead: 'Elafonissi met ondiep turquoise water, Vai met een echte palmboomgaard aan zee — twee kusten, twee karakters. Geen herhaling van dezelfde lagune.',
        layout: 'image-left',
        media: westMedia,
        contextualBridgeLabel: 'Vakanties naar Kreta vergelijken',
      },
      {
        id: 'cultuur',
        title: 'Cultuur & eilanden',
        lead: 'Knossos brengt Minoïsche schaal; Spinalonga ligt als een silhouet in de golf. Kreta als verhaal, niet alleen als strand.',
        layout: 'image-right',
        media: cultureMedia,
      },
      {
        id: 'wild',
        title: 'Wild Kreta',
        lead: 'In de Samaria-kloof wordt het eiland smal tussen rotswanden en een beek. Dit is het andere gezicht van Kreta.',
        layout: 'stack',
        media: wildMedia,
      },
    ],
    wow,
    wowCaption: 'En dan dit — Balos van boven: zandbank, lagune, open zee.',
    desire: {
      title: 'Hier zou je wel naartoe willen',
      body: 'Niet om drie stranden af te vinken, maar omdat de plekken concreet worden: havenlicht in Chania, klifpaden in Samaria, een lagune die je nergens anders zo ziet. Daarna is de vraag: wat zou een vakantie hier kosten?',
      media: null,
    },
    practical: {
      title: 'Praktisch, kort',
      items: [
        'West (Chania/Elafonissi) en oost (Vai/Spinalonga) zijn verder uit elkaar dan de kaart suggereert',
        'Voor- en naseizoen: warmer water met minder drukte op de lagunes',
        'Reken op zo’n week tot tien dagen om kust én binnenland te proeven',
      ] as const,
    },
    budget: {
      title: 'Budget',
      body: 'Kreta loopt van eenvoudige kustdorpen tot resorts. Wat het écht kost, zie je pas als je vakanties vergelijkt — geen catalogusprijs hier.',
    },
    resultsHref,
    earlyBridgeLabel: 'Bekijk wat er aan vakanties is',
    finalBridgeLabel: `Vergelijk vakanties naar ${destination.name}`,
  };
}