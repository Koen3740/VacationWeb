/**
 * Shared C2 Destination Experience types (P10/P11).
 */
import type { DiscoverDestination } from './types';

export type ExperienceMediaSlot = {
  assetId: string;
  src: string;
  placeId?: string;
  placeLabel: string;
  role: string;
};

export type ExperienceChapterBlock = {
  id: string;
  title: string;
  lead: string;
  layout: 'image-left' | 'image-right' | 'stack';
  media: ExperienceMediaSlot[];
  contextualBridgeLabel?: string;
};

export type DestinationExperienceModel = {
  destination: DiscoverDestination;
  heroSrc: string;
  heroAssetId: string;
  essenceTitle: string;
  essence: string;
  why: readonly string[];
  chapters: ExperienceChapterBlock[];
  wow: ExperienceMediaSlot | null;
  wowCaption: string;
  desire: {
    title: string;
    body: string;
    media: ExperienceMediaSlot | null;
  };
  practical: { title: string; items: readonly string[] };
  budget: { title: string; body: string };
  resultsHref: string;
  earlyBridgeLabel: string;
  finalBridgeLabel: string;
};