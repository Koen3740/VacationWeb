'use client';

import type { ResultsIntroVariant } from '@/components/results-v2/results-intro-copy';

const TABS: Array<{ id: ResultsIntroVariant; label: string }> = [
  { id: 'country', label: '1 land' },
  { id: 'region', label: '1 regio' },
  { id: 'multi', label: 'Meerdere landen' },
  { id: 'all', label: 'Alle landen' },
];

type ResultsVariantTabsProps = {
  active: ResultsIntroVariant;
  onChange: (variant: ResultsIntroVariant) => void;
};

/** Layout review tabs — intro content only; no search logic */
export function ResultsVariantTabs({ active, onChange }: ResultsVariantTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`h-9 rounded-full px-3.5 text-[13px] font-semibold transition ${
              isActive
                ? 'bg-[#0A2D62] text-white'
                : 'border border-[#D9E0EA] bg-white text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
