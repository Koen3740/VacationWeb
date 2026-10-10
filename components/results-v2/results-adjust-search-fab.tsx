'use client';

import { RESULTS_CTA, RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';

/** Scrolls to top so the search bar is in view — no popup yet */
export function ResultsAdjustSearchFab({
  tone = 'default',
}: {
  /** `results` matches Layout A and hides the control on small screens. */
  tone?: 'default' | 'results';
}) {
  if (tone === 'results') {
    return (
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-[22px] right-[22px] z-40 hidden h-[46px] items-center gap-[9px] rounded-full border border-[#e1dacd] bg-white py-0 pl-2 pr-[18px] text-[13px] font-semibold text-vw-navy shadow-vw-fab min-[901px]:inline-flex"
        aria-label="Zoekopdracht aanpassen"
      >
        <span
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-white"
          style={{ backgroundColor: 'var(--vw-navy)' }}
          aria-hidden
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="2.2" />
            <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        Zoekopdracht aanpassen
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[13px] font-semibold text-[#0A2D62] shadow-[0_10px_28px_rgba(10,45,98,0.18)] ring-1 ring-[#D9E0EA] transition hover:shadow-[0_12px_32px_rgba(10,45,98,0.22)]"
      aria-label="Zoekopdracht aanpassen"
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: RESULTS_CTA }}
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 16.5 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span style={{ color: RESULTS_NAVY }}>Zoekopdracht aanpassen</span>
    </button>
  );
}
