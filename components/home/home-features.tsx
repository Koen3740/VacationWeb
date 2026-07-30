function CompareProvidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="4" y="5" width="6" height="14" rx="1.5" stroke="white" strokeWidth="1.6" />
      <rect x="14" y="5" width="6" height="14" rx="1.5" stroke="white" strokeWidth="1.6" />
      <path d="M10 10h4M10 14h4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BudgetValueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M4 18V6l8-3 8 3v12l-8 3-8-3z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.5c0-1.2 1-2 3-2s3 .8 3 2-1 2-3 2-3 .8-3 2 1 2 3 2 3 .8 3 2"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterPreferencesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="6" cy="6" r="2" stroke="white" strokeWidth="1.6" />
      <circle cx="14" cy="12" r="2" stroke="white" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="2" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}

function DirectBookingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M7 7h10v10H7V7z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M11 12h6M15 9l3 3-3 3"
        stroke="white"
        strokeWidth="1.6"
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
    <div className="mt-7 grid grid-cols-1 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-0">
      {features.map((feature) => (
        <div key={feature.label} className="flex min-w-0 items-start gap-2.5 lg:items-center">
          {feature.icon}
          <span className="min-w-0 text-sm font-medium leading-snug text-white">{feature.label}</span>
        </div>
      ))}
    </div>
  );
}
