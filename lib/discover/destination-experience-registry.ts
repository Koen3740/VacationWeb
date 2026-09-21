/**
 * C2 Destination Experience registry — Albania (P10) + Sicily (P11) + Crete (P12) + Sardinia (P13).
 */
import {
  ALBANIA_DESTINATION_ID,
  buildAlbaniaExperienceModel,
} from './albania-experience';
import type { DestinationExperienceModel } from './destination-experience-types';
import {
  CRETE_DESTINATION_ID,
  buildCreteExperienceModel,
} from './crete-experience';
import {
  SARDINIA_DESTINATION_ID,
  buildSardiniaExperienceModel,
} from './sardinia-experience';
import {
  SICILY_DESTINATION_ID,
  buildSicilyExperienceModel,
} from './sicily-experience';

function adaptAlbania(): DestinationExperienceModel | null {
  const m = buildAlbaniaExperienceModel();
  if (!m) return null;
  return {
    destination: m.destination,
    heroSrc: m.heroSrc,
    heroAssetId: m.heroAssetId,
    essenceTitle: 'Waarom Albanië',
    essence: m.essence,
    why: m.why,
    chapters: m.chapters as DestinationExperienceModel['chapters'],
    wow: m.wow as DestinationExperienceModel['wow'],
    wowCaption: m.wowCaption,
    desire: m.desire as DestinationExperienceModel['desire'],
    practical: m.practical,
    budget: m.budget,
    resultsHref: m.resultsHref,
    earlyBridgeLabel: m.earlyBridgeLabel,
    finalBridgeLabel: m.finalBridgeLabel,
  };
}

const BUILDERS: Record<string, () => DestinationExperienceModel | null> = {
  [ALBANIA_DESTINATION_ID]: adaptAlbania,
  [SICILY_DESTINATION_ID]: buildSicilyExperienceModel,
  [CRETE_DESTINATION_ID]: buildCreteExperienceModel,
  [SARDINIA_DESTINATION_ID]: buildSardiniaExperienceModel,
};

export function hasDestinationExperience(destinationId: string): boolean {
  return Boolean(BUILDERS[destinationId.toLowerCase()]);
}

export function buildDestinationExperienceModel(
  destinationId: string,
): DestinationExperienceModel | null {
  const builder = BUILDERS[destinationId.toLowerCase()];
  return builder ? builder() : null;
}