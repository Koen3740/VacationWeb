'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * After page-1 live pricing completes, persist presented IDs in the URL
 * without a Next.js navigation so later catalog-only filters can skip Receipt.
 */
export function SyncPage1IdsToUrl({
  page1Ids,
  replaceExisting = false,
}: {
  page1Ids: string[];
  replaceExisting?: boolean;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (page1Ids.length === 0 || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const current = params.get('page1Ids');
    const next = page1Ids.join(',');
    if (!replaceExisting && current) {
      return;
    }
    if (current === next) {
      return;
    }

    params.set('page1Ids', next);
    const query = params.toString();
    window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname);
  }, [page1Ids, pathname, replaceExisting]);

  return null;
}
