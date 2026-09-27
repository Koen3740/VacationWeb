'use client';

import { useEffect, useRef } from 'react';

/**
 * Caps visible Result cards on page 1 while allowing reserve candidates to backfill
 * when primary slots settle without a presentable price.
 *
 * Default display = live B arrival order: slots are shown in the order their
 * presentable card first appeared (not discovery/catalogue DOM order). Once
 * `limit` cards are shown, later arrivals stay hidden (page-1 freeze / Cap).
 */
export function Page1ResultsCap({
  children,
  limit,
}: {
  children: React.ReactNode;
  limit: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const arrivalOrderRef = useRef<string[]>([]);
  const arrivalSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const applyCap = () => {
      const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-page1-slot]'));
      const arrivalOrder = arrivalOrderRef.current;
      const arrivalSeen = arrivalSeenRef.current;

      slots.forEach((slot, index) => {
        const id = slot.dataset.offerId || '';
        const key = id || `anon:${index}`;
        const card = slot.querySelector('article');
        if (card && !arrivalSeen.has(key)) {
          arrivalSeen.add(key);
          arrivalOrder.push(key);
        }
      });

      const slotByKey = new Map<string, HTMLElement>();
      slots.forEach((slot, index) => {
        const id = slot.dataset.offerId || '';
        slotByKey.set(id || `anon:${index}`, slot);
      });

      const shownKeys = new Set<string>();
      let shown = 0;
      for (const key of arrivalOrder) {
        if (shown >= limit) break;
        const slot = slotByKey.get(key);
        if (!slot?.querySelector('article')) continue;
        slot.style.display = '';
        shownKeys.add(key);
        shown += 1;
      }

      for (const [key, slot] of slotByKey) {
        if (!shownKeys.has(key)) {
          slot.style.display = 'none';
        }
      }
    };

    applyCap();
    const observer = new MutationObserver(applyCap);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [limit]);

  return (
    <div ref={rootRef} className="space-y-3.5">
      {children}
    </div>
  );
}
