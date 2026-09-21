/**
 * P13 - Sardinië Active Experience Set + chapter story (editorial, fixed).
 * FINAL Destination Media Pool only. No P12.5 inbox activation (RIGHTS_OK=0).
 * Avoids beach-stack redundancy; teaser ≠ hero ≠ WOW places.
 */
import { buildDiscoverResultsHref } from './discover-destination-href';
import { getDiscoverDestinationById } from './discover-pool';
import type { DestinationExperienceModel } from './destination-experience-types';
import {
  finalsByDestinationId,
  firstAvailableSlot,
  resolveExperienceSlot,
} from './resolve-experience-media';

export const SARDINIA_DESTINATION_ID = 'sardinia' as const;

/** Fixed Active Experience Set — geographic + cultural diversity. */
export const SARDINIA_ACTIVE_EXPERIENCE = {
  teaserPreferred: 'vw-story-sardinia-cala-goloritze-aguglia-commons',
  hero: 'vw-story-sardinia-tavolara-18660972',
  eastCalaLuna: 'vw-pool-sardinia-cala-luna',
  eastMaddalena: 'vw-pool-sardinia-maddalena',
  cultureNuraghe: 'vw-story-sardinia-nuraghe-su-nuraxi-19',
  wildGorropu: 'vw-pool-sardinia-gorropu',
  westPiscinas: 'vw-story-sardinia-piscinas-dunes-arbus10',
  wowInterrupt: 'vw-story-sardinia-porto-pino-35142345',
} as const;

/** Explicitly not in Active Set (redundant beach / near-dup / optional). */
export const SARDINIA_EXCLUDED_FROM_ACTIVE = [
  'vw-story-sardinia-cliff-beach-aerial-23962079', // same place family as teaser Goloritzé
  'vw-story-sardinia-tavolara-profilo-commons', // near-dup of hero Tavolara
  'vw-story-sardinia-emerald-coast-38146980', // another turquoise coast — beach overload
  'vw-pool-sardinia-la-pelosa', // lagoon beach — not needed with Porto Pino WOW + east coves
] as const;

export function buildSardiniaExperienceModel(): DestinationExperienceModel | null {
  const destination = getDiscoverDestinationById(SARDINIA_DESTINATION_ID);
  if (!destination) return null;

  const byId = finalsByDestinationId(SARDINIA_DESTINATION_ID);
  const exclude = new Set<string>();

  const hero =
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.hero, 'hero-scale', exclude) ??
    firstAvailableSlot(
      byId,
      [
        'vw-story-sardinia-tavolara-profilo-commons',
        'vw-story-sardinia-nuraghe-su-nuraxi-19',
        'vw-story-sardinia-porto-pino-35142345',
      ],
      'hero-scale',
      exclude,
    );

  if (!hero) return null;
  exclude.add(hero.assetId);

  const eastMedia = [
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.eastCalaLuna, 'anchor-place', exclude),
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.eastMaddalena, 'place', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const cultureMedia = [
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.cultureNuraghe, 'establishing', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const wildMedia = [
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.westPiscinas, 'place', exclude),
    resolveExperienceSlot(byId, SARDINIA_ACTIVE_EXPERIENCE.wildGorropu, 'scale-desire', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const wow = firstAvailableSlot(
    byId,
    [SARDINIA_ACTIVE_EXPERIENCE.wowInterrupt],
    'wow-interrupt',
    exclude,
  );
  if (wow) exclude.add(wow.assetId);

  const resultsHref = buildDiscoverResultsHref(SARDINIA_DESTINATION_ID);

  return {
    destination,
    heroSrc: hero.src,
    heroAssetId: hero.assetId,
    essenceTitle: 'Waarom Sardinië',
    essence: 'Klifkusten, wilde duinen en nuraghi — één eiland, meerdere werelden.',
    why: [
      'Oostkust met kalkrotsen én archipelwater in één reis',
      'Su Nuraxi: steen die ouder is dan de resorts',
      'Niet alleen strand — ook Gorropu, Piscinas, Tavolara',
    ] as const,
    chapters: [
      {
        id: 'oostkust',
        title: 'Oostkust & archipel',
        lead: 'Cala Luna als maanvormige klifbaai, La Maddalena als eilandenrijk — twee kanten van hetzelfde blauw, zonder dezelfde baai te herhalen.',
        layout: 'image-left',
        media: eastMedia,
        contextualBridgeLabel: 'Vakanties naar Sardinië vergelijken',
      },
      {
        id: 'steen',
        title: 'Steen & tijd',
        lead: 'Su Nuraxi bij Barumini zet Sardinië neer als cultuurland: torens van steen, geen reclamefoto van een ligbed.',
        layout: 'stack',
        media: cultureMedia,
      },
      {
        id: 'duinen-wild',
        title: 'Duinen & wild',
        lead: 'Piscinas is zand dat landinwaarts golft; Gorropu is een kloof waar het eiland smal wordt. Sardinië als landschap, niet als checklist.',
        layout: 'image-right',
        media: wildMedia,
      },
    ],
    wow,
    wowCaption: 'En dan dit — Porto Pino: witte duinen die in turquoise water lopen.',
    desire: {
      title: 'Hier zou je wel naartoe willen',
      body: 'Niet om nog een turquoise baai af te vinken, maar omdat de plekken concreet worden: de Aguglia-spits, Tavolara als silhouet, een nuraghe in de zon. Daarna is de vraag: wat zou een vakantie hier kosten?',
      media: null,
    },
    practical: {
      title: 'Praktisch, kort',
      items: [
        'Noord (Maddalena/Tavolara) en oost (Ogliastra) zijn verder uit elkaar dan de kaart suggereert',
        'Voor- en naseizoen: rustiger op de klifbaaien, warmer water zonder hoogseizoendrukte',
        "Reken op zo'n week tot tien dagen om kust én binnenland te proeven",
      ] as const,
    },
    budget: {
      title: 'Budget',
      body: 'Sardinië loopt van eenvoudige kustdorpen tot Costa Smeralda-prijzen. Wat het écht kost, zie je pas als je vakanties vergelijkt — geen catalogusprijs hier.',
    },
    resultsHref,
    earlyBridgeLabel: 'Bekijk wat er aan vakanties is',
    finalBridgeLabel: `Vergelijk vakanties naar ${destination.name}`,
  };
}