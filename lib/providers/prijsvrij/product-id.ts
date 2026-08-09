/**
 * Feed externalId shape: prijsvrij-{productId}-{departureDate}-{duration}-{minimumPrice}-{boardType}
 * Product ID is the TradeTracker/XML product ID and matches Search List[].Id.
 */
export function extractPrijsvrijProductId(externalId: string): string | null {
  const match = /^prijsvrij-(\d+)(?:-|$)/i.exec(externalId.trim());
  return match?.[1] ?? null;
}
