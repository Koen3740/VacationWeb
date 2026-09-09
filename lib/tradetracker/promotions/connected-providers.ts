import { getEnabledFeeds } from '@/lib/feeds/feed-registry';
import { RUNTIME_CATALOG_ACTIVE_PROVIDERS } from '@/lib/offers/catalog-shards';

export type ConnectedTravelProviderName = (typeof RUNTIME_CATALOG_ACTIVE_PROVIDERS)[number];

/**
 * Canonical VacationWeb travel providers that are active in Results/catalog.
 * Derived from existing runtime catalog config — not a new hardcoded list.
 */
export function getConnectedTravelProviderNames(): readonly ConnectedTravelProviderName[] {
  return RUNTIME_CATALOG_ACTIVE_PROVIDERS;
}

/** TradeTracker campaign IDs from enabled feeds for connected providers. */
export function getConnectedTradeTrackerCampaignIds(): Set<string> {
  const allowedProviders = new Set(
    getConnectedTravelProviderNames().map((name) => name.toLowerCase()),
  );
  const ids = new Set<string>();
  for (const feed of getEnabledFeeds()) {
    if (!allowedProviders.has(feed.provider.toLowerCase())) {
      continue;
    }
    const campaignId = feed.campaignId?.trim();
    if (campaignId) {
      ids.add(campaignId);
    }
  }
  return ids;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Map a TradeTracker campaign to a connected VacationWeb provider, or null.
 * Matches enabled-feed campaign IDs first, then provider-name identity on the campaign title.
 */
export function resolveConnectedProvider(args: {
  campaignId: string | null;
  campaignName: string | null;
}): ConnectedTravelProviderName | null {
  const connected = getConnectedTravelProviderNames();
  const campaignIds = getConnectedTradeTrackerCampaignIds();

  if (args.campaignId && campaignIds.has(args.campaignId.trim())) {
    for (const feed of getEnabledFeeds()) {
      if (feed.campaignId?.trim() === args.campaignId.trim()) {
        const match = connected.find(
          (provider) => provider.toLowerCase() === feed.provider.toLowerCase(),
        );
        if (match) {
          return match;
        }
      }
    }
  }

  const campaignName = args.campaignName ? normalizeToken(args.campaignName) : '';
  if (!campaignName) {
    return null;
  }

  for (const provider of connected) {
    const token = normalizeToken(provider);
    if (
      campaignName === token ||
      campaignName.startsWith(`${token} `) ||
      campaignName.startsWith(`${token}.`) ||
      campaignName.startsWith(`${token}-`) ||
      campaignName.startsWith(`${token}_`)
    ) {
      return provider;
    }
  }

  return null;
}
