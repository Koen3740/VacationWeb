/**
 * Homepage USP strip — visual language matched to ResultsUspBar
 * (light surface, circular icon wells, navy labels).
 */

function CompareProvidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="4" y="5" width="6" height="14" rx="1.5" stroke="#89ACD3" strokeWidth="1.5" />
      <rect x="14" y="5" width="6" height="14" rx="1.5" stroke="#89ACD3" strokeWidth="1.5" />
      <path d="M10 10h4M10 14h4" stroke="#89ACD3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BudgetValueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M12 3l2.4 5.4 5.9.5-4.5 3.9 1.4 5.7L12 16.8 6.8 18.5l1.4-5.7-4.5-3.9 5.9-.5L12 3z"
        stroke="#89ACD3"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function FilterPreferencesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="#89ACD3" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="6" r="2" stroke="#89ACD3" strokeWidth="1.5" />
      <circle cx="14" cy="12" r="2" stroke="#89ACD3" strokeWidth="1.5" />
      <circle cx="12" cy="18" r="2" stroke="#89ACD3" strokeWidth="1.5" />
    </svg>
  );
}

function DirectBookingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M7 7h10v10H7V7z" stroke="#89ACD3" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M11 12h6M15 9l3 3-3 3"
        stroke="#89ACD3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  { icon: <CompareProvidersIcon />, label: 'Vergelijk meerdere reisaanbieders' },
  { icon: <BudgetValueIcon />, label: 'Ontdek waar jouw budget het meeste oplevert' },
  { icon: <FilterPreferencesIcon />, label: 'Filter op budget, reisduur en voorkeuren' },
  { icon: <DirectBookingIcon />, label: 'Boek rechtstreeks bij de reisorganisatie' },
];

export function HomeFeatures() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {features.map((feature) => (
        <div key={feature.label} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            {feature.icon}
          </span>
          <span className="min-w-0 text-[13px] font-medium leading-snug text-[#0A2D62]">
            {feature.label}
          </span>
        </div>
      ))}
    </div>
  );
}
