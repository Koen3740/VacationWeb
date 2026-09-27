'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CATALOG_GENERATION_PARAM } from '@/lib/search/catalog-generation-freeze';

/**
 * After page-1 live pricing completes, persist presented IDs in the URL
 * without a Next.js navigation so later catalog-only filters can skip Receipt.
 * When `catalogGen` is provided (definitive READY/EXHAUSTED freeze only), stamp
 * the catalog generation alongside page1Ids (Page 15 Gold).
 */
export function SyncPage1IdsToUrl({
  page1Ids,
  replaceExisting = false,
  catalogGen,
}: {
  page1Ids: string[];
  replaceExisting?: boolean;
  /** Runtime generationId — only pass for DEFINITIVE freeze (READY/EXHAUSTED). */
  catalogGen?: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (page1Ids.length === 0 || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const current = params.get('page1Ids');
    const next = page1Ids.join(',');
    const stamp = typeof catalogGen === 'string' ? catalogGen.trim() : '';
    const currentGen = params.get(CATALOG_GENERATION_PARAM) ?? '';
    if (!replaceExisting && current) {
      return;
    }
    if (current === next && (!stamp || currentGen === stamp)) {
      return;
    }

    params.set('page1Ids', next);
    if (stamp) {
      params.set(CATALOG_GENERATION_PARAM, stamp);
    }
    const query = params.toString();
    window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname);
  }, [page1Ids, pathname, replaceExisting, catalogGen]);

  return null;
}
