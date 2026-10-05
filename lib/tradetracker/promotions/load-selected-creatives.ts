import fs from 'node:fs/promises';
import path from 'node:path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE } from './constants';
import { mapCreativeProvider, selectedCreativeFileName } from './select-creatives';
import type { VacationWebPromotionMarket } from './select-displayable';
import { CREATIVE_ALLOWED_PROVIDERS, type SelectedTradeTrackerCreative, type SelectedTradeTrackerCreativeSnapshot } from './types';

/**
 * Primary `/aanbiedingen` source: Slice 2 selected creative snapshots.
 * NL reads selected-nl-512226.json. BE reads selected-be-511873.json.
 * A missing file is an empty primary set so secondary promotions can still show.
 * This module only reads local JSON. It does not call TradeTracker.
 */

export type SelectedCreativeLoadStatus = 'ok' | 'missing' | 'invalid';

export type LoadedSelectedCreatives = {
  market: VacationWebPromotionMarket;
  affiliateSiteId: string;
  sourceFile: string;
  creatives: SelectedTradeTrackerCreative[];
  skipped: number;
  status: SelectedCreativeLoadStatus;
  error: string | null;
};

export function selectedCreativeSnapshotPath(
  market: VacationWebPromotionMarket,
  root = process.cwd(),
): string {
  const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  return path.join(root, 'data', 'tradetracker-creatives', selectedCreativeFileName(market, affiliateSiteId));
}

function isTuiText(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\btui\b/i.test(value);
}

function isAllowedProvider(value: string): boolean {
  return (CREATIVE_ALLOWED_PROVIDERS as readonly string[]).includes(value);
}

/** Fail closed: market, canonical site, allowed provider, and campaign identity must agree. */
export function acceptSelectedCreativeForMarket(
  market: VacationWebPromotionMarket,
  creative: SelectedTradeTrackerCreative,
): boolean {
  if (creative.displayable !== true) {
    return false;
  }
  if (creative.market !== market) {
    return false;
  }
  if (creative.affiliateSiteId !== TRADETRACKER_CREATIVE_CANONICAL_SITE[market]) {
    return false;
  }
  if (!isAllowedProvider(creative.provider)) {
    return false;
  }
  if (
    isTuiText(creative.provider) ||
    isTuiText(creative.campaignName) ||
    isTuiText(creative.title)
  ) {
    return false;
  }
  const mapped = mapCreativeProvider({
    campaignName: creative.campaignName,
    campaignUrl: creative.campaignUrl,
  });
  return mapped === creative.provider;
}

export async function loadSelectedCreativesForMarket(
  market: VacationWebPromotionMarket,
  options: { root?: string } = {},
): Promise<LoadedSelectedCreatives> {
  const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  const sourceFile = selectedCreativeSnapshotPath(market, options.root);
  const empty = {
    market,
    affiliateSiteId,
    sourceFile,
    creatives: [] as SelectedTradeTrackerCreative[],
    skipped: 0,
  };

  let raw: string;
  try {
    raw = await fs.readFile(sourceFile, 'utf8');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') {
      return { ...empty, status: 'missing', error: null };
    }
    return {
      ...empty,
      status: 'invalid',
      error: 'Selected creative snapshot kon niet worden gelezen',
    };
  }

  let parsed: SelectedTradeTrackerCreativeSnapshot;
  try {
    parsed = JSON.parse(raw) as SelectedTradeTrackerCreativeSnapshot;
  } catch {
    return { ...empty, status: 'invalid', error: 'Selected creative snapshot is ongeldig' };
  }

  if (parsed.market !== market || parsed.scopedAffiliateSiteId !== affiliateSiteId) {
    return {
      ...empty,
      status: 'invalid',
      error: 'Selected creative snapshot hoort bij een andere markt of site',
    };
  }

  const creatives: SelectedTradeTrackerCreative[] = [];
  let skipped = 0;
  for (const creative of parsed.creatives ?? []) {
    if (acceptSelectedCreativeForMarket(market, creative)) {
      creatives.push(creative);
    } else {
      skipped += 1;
    }
  }

  return {
    ...empty,
    creatives,
    skipped,
    status: 'ok',
    error: null,
  };
}
