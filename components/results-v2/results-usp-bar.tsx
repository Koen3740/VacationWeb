import React, { type ReactNode } from 'react';

const ITEMS = [
  {
    label: 'Meer vakantie voor jouw budget',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l2.4 5.4 5.9.5-4.5 3.9 1.4 5.7L12 16.8 6.8 18.5l1.4-5.7-4.5-3.9 5.9-.5L12 3z"
          stroke="#89ACD3"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  {
    label: 'Geselecteerd op prijs-kwaliteit',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 8h14l-1.5 11h-11L5 8z" stroke="#89ACD3" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 016 0v2" stroke="#89ACD3" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'Betrouwbare partners en veilige betaling',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="#89ACD3" strokeWidth="1.5" />
        <path d="M8 11V8a4 4 0 018 0v3" stroke="#89ACD3" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: '24/7 ondersteuning voor en na je reis',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 12a8 8 0 0116 0v5a2 2 0 01-2 2h-2v-6h4M4 13h4v6H6a2 2 0 01-2-2v-4z"
          stroke="#89ACD3"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

const RESULTS_REMOVED_CLAIMS = [
  'Betrouwbare partners en veilige betaling',
  '24/7 ondersteuning voor en na je reis',
] as const;

type ResultsUspBarProps = {
  /**
   * `results` drops claims VacationWeb does not make (no payment, no support).
   * `default` is the existing bar used by other pages.
   */
  variant?: 'default' | 'results';
};

function ResultsUspIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[18px] text-vw-gold">
      {children}
    </span>
  );
}

export function ResultsUspBar({ variant = 'default' }: ResultsUspBarProps) {
  if (variant === 'results') {
    const items = ITEMS.filter(
      (item) => !RESULTS_REMOVED_CLAIMS.includes(item.label as (typeof RESULTS_REMOVED_CLAIMS)[number]),
    );
    return (
      <div className="border-t border-vw-line bg-vw-usp" data-testid="results-usp-bar">
        <div className="mx-auto flex max-w-vw-page flex-col gap-3.5 px-4 py-[18px] font-vw-sans min-[901px]:flex-row min-[901px]:flex-wrap min-[901px]:gap-10 min-[901px]:px-7 min-[901px]:py-[22px]">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-[14px] font-medium text-vw-navy">
              <ResultsUspIcon>{item.icon}</ResultsUspIcon>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#DCE4EE] bg-[#EAF1F7]">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:px-8">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              {item.icon}
            </span>
            <p className="text-[13px] font-medium leading-snug text-[#0A2D62]">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
