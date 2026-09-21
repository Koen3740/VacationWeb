/**
 * P11 — Sicilië Active Experience Set + chapter story (editorial, fixed).
 * Pool remains audit SSOT; visitor sees only this curated set.
 */
import { buildDiscoverResultsHref } from './discover-destination-href';
import { getDiscoverDestinationById } from './discover-pool';
import type { DestinationExperienceModel } from './destination-experience-types';
import {
  finalsByDestinationId,
  firstAvailableSlot,
  resolveExperienceSlot,
} from './resolve-experience-media';

export const SICILY_DESTINATION_ID = 'sicily' as const;

/** Fixed Active Experience Set — quality over rotation. */
export const SICILY_ACTIVE_EXPERIENCE = {
  teaserPreferred: 'vw-story-sicily-isola-bella-37105275',
  hero: 'vw-story-sicily-taormina-teatro-etna-commons',
  eastPlace: 'vw-pool-sicily-ortigia',
  eastDetail: 'vw-pool-sicily-alcantara',
  northEstablishing: 'vw-story-sicily-cefalu-view-0832-commons',
  northWaterfront: 'vw-story-sicily-cefalu-waterfront-18453312',
  antiekLandscape: 'vw-story-sicily-concordia-valle-2024-commons',
  antiekDetail: 'vw-story-sicily-concordia-temple-37261506',
  wowInterrupt: 'vw-pool-sicily-scala-dei-turchi',
  desire: 'vw-pool-sicily-noto-duomo',
} as const;

export function buildSicilyExperienceModel(): DestinationExperienceModel | null {
  const destination = getDiscoverDestinationById(SICILY_DESTINATION_ID);
  if (!destination) return null;

  const byId = finalsByDestinationId(SICILY_DESTINATION_ID);
  const heroId = SICILY_ACTIVE_EXPERIENCE.hero;
  const exclude = new Set<string>([heroId]);

  const hero =
    resolveExperienceSlot(byId, heroId, 'hero-scale', new Set()) ??
    firstAvailableSlot(
      byId,
      [
        'vw-story-sicily-cefalu-view-0832-commons',
        'vw-pool-sicily-scala-dei-turchi',
      ],
      'hero-scale',
      new Set(),
    );

  if (!hero) return null;
  exclude.add(hero.assetId);

  const eastMedia = [
    resolveExperienceSlot(byId, SICILY_ACTIVE_EXPERIENCE.eastPlace, 'place', exclude),
    resolveExperienceSlot(byId, SICILY_ACTIVE_EXPERIENCE.eastDetail, 'detail', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const northMedia = [
    resolveExperienceSlot(
      byId,
      SICILY_ACTIVE_EXPERIENCE.northEstablishing,
      'establishing',
      exclude,
    ),
    resolveExperienceSlot(
      byId,
      SICILY_ACTIVE_EXPERIENCE.northWaterfront,
      'place',
      exclude,
    ),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const antiekMedia = [
    resolveExperienceSlot(
      byId,
      SICILY_ACTIVE_EXPERIENCE.antiekLandscape,
      'establishing',
      exclude,
    ),
    resolveExperienceSlot(byId, SICILY_ACTIVE_EXPERIENCE.antiekDetail, 'detail', exclude),
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  const wow = firstAvailableSlot(
    byId,
    [SICILY_ACTIVE_EXPERIENCE.wowInterrupt],
    'wow-interrupt',
    exclude,
  );
  if (wow) exclude.add(wow.assetId);

  const desireMedia = resolveExperienceSlot(
    byId,
    SICILY_ACTIVE_EXPERIENCE.desire,
    'desire',
    exclude,
  );

  const resultsHref = buildDiscoverResultsHref(SICILY_DESTINATION_ID);

  return {
    destination,
    heroSrc: hero.src,
    heroAssetId: hero.assetId,
    essenceTitle: 'Waarom Sicilië',
    essence: 'Vulkaan, tempels en zee — één eiland, drie werelden.',
    why: [
      'Etna en antiek theater op één horizon',
      'Griekse tempels in een levend landschap',
      'Noordkust-steden met eigen ritme — en die witte kliffen',
    ] as const,
    chapters: [
      {
        id: 'oostkust',
        title: 'Oostkust & Etna',
        lead: 'Aan de oostkant voel je de vulkaan mee. Ortigia aan zee, Alcantara in basalt — Sicilië als schaal én contrast.',
        layout: 'image-left',
        media: eastMedia,
        contextualBridgeLabel: 'Vakanties naar Sicilië vergelijken',
      },
      {
        id: 'cefalu',
        title: 'Noordkust — Cefalù',
        lead: 'Oranje daken onder La Rocca, de zee eronder. Cefalù is geen stopje — het is hoe de noordkust aanvoelt.',
        layout: 'image-right',
        media: northMedia,
      },
      {
        id: 'antiek',
        title: 'Antiek Sicilië',
        lead: 'In de Valle dei Templi staan Griekse tempels in olijfbomen, met de zee in de verte. Geschiedenis met wind erdoor.',
        layout: 'image-left',
        media: antiekMedia,
      },
    ],
    wow,
    wowCaption: 'En dan dit — wit als krijt, steil als een trap naar zee.',
    desire: {
      title: 'Hier zou je wel naartoe willen',
      body: 'Niet om een checklist af te vinken, maar omdat de plekken concreet worden: theater met Etna, tempels in de wind, barok in Noto. Daarna is de vraag: wat zou een vakantie hier kosten?',
      media: desireMedia,
    },
    practical: {
      title: 'Praktisch, kort',
      items: [
        'Een auto helpt — oost, noord en zuid zijn verder dan de kaart suggereert',
        'Voor- en naseizoen combineren warmte met minder drukte',
        'Reken op zo’n week tot tien dagen om kust én cultuur te proeven',
      ] as const,
    },
    budget: {
      title: 'Budget',
      body: 'Sicilië kan van roadtrip-eenvoudig tot resort lopen. Wat het écht kost, zie je pas als je vakanties vergelijkt — geen catalogusprijs hier.',
    },
    resultsHref,
    earlyBridgeLabel: 'Bekijk wat er aan vakanties is',
    finalBridgeLabel: `Vergelijk vakanties naar ${destination.name}`,
  };
}