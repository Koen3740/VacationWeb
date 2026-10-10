'use client';

import { useEffect, useRef } from 'react';

/**
 * Variant 1: the fixed photo dims slightly as the page scrolls (max 0.28),
 * so glass copy stays readable. Skipped when the visitor prefers reduced motion.
 */
export function HomePhotoDim() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!node || reduce.matches) {
      return undefined;
    }

    let frame = 0;
    const apply = () => {
      const y = window.scrollY;
      const height = window.innerHeight || 1;
      const amount = Math.min(0.28, Math.max(0, (y - height * 0.35) / (height * 1.6)) * 0.28);
      node.style.opacity = amount.toFixed(3);
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const onReduce = () => {
      if (reduce.matches) {
        node.style.opacity = '0';
      }
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    reduce.addEventListener('change', onReduce);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);

  return <div ref={ref} className="vw-home-photo-dim" />;
}
