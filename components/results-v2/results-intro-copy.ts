import type { ReactNode } from 'react';

export type ResultsIntroContent = {
  heroTitle: ReactNode;
  heroSubtitle: string;
};

/** Shared hero supporting line — not variant/demo copy */
export const DEFAULT_RESULTS_HERO_SUBTITLE =
  'Vergelijk vakanties van meerdere reispartners en ontdek waar jouw budget het meeste vakantie oplevert.';
