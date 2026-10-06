import { unstable_cache } from 'next/cache';
import { readIsolatedCreativeDocument } from './creative-documents';

/** Published creative JSON only. This does not call TradeTracker. */
const REVALIDATE_SECONDS = 300;

export const readCachedCreativeDocument = unstable_cache(
  async (key: string) => readIsolatedCreativeDocument(key),
  ['vw-tradetracker-creative-document'],
  { revalidate: REVALIDATE_SECONDS },
);
