function PartnerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 18h16M6 18V9l6-4 6 4v9M9 18v-4h6v4"
        stroke="#0A2D62"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#0A2D62" strokeWidth="1.8" />
      <path d="M12 8v8M9 11h6" stroke="#0A2D62" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
        stroke="#0A2D62"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 12l2 2 4-4" stroke="#0A2D62" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8a8 8 0 0116 0v3a2 2 0 002 2v1a2 2 0 01-2 2h-1.5a2.5 2.5 0 01-5 0h-3a2.5 2.5 0 01-5 0H6a2 2 0 01-2-2v-1a2 2 0 012-2V8z"
        stroke="#0A2D62"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  { icon: <PartnerIcon />, label: 'Meer dan 300 reispartners' },
  { icon: <PriceIcon />, label: 'Laagste prijsgarantie' },
  { icon: <ShieldIcon />, label: 'Veilig boeken' },
  { icon: <SupportIcon />, label: '24/7 klantenservice' },
];

export function HomeFeatures() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {features.map((feature) => (
        <div key={feature.label} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95">
            {feature.icon}
          </span>
          <span className="text-sm font-medium text-white">{feature.label}</span>
        </div>
      ))}
    </div>
  );
}
