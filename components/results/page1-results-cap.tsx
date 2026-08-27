'use client';

import { useEffect, useRef } from 'react';

/**
 * Caps visible Result cards on page 1 while allowing reserve candidates to backfill
 * when primary slots settle without a presentable price.
 */
export function Page1ResultsCap({
  children,
  limit,
}: {
  children: React.ReactNode;
  limit: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const applyCap = () => {
      const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-page1-slot]'));
      let shown = 0;

      for (const slot of slots) {
        const card = slot.querySelector('article');
        if (!card) {
          slot.style.display = 'none';
          continue;
        }
        if (shown < limit) {
          slot.style.display = '';
          shown += 1;
        } else {
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
