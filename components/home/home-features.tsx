function PartnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="8" r="3.5" stroke="white" strokeWidth="1.6" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="6" y="11" width="12" height="9" rx="2" stroke="white" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 118 0v3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M4 8a8 8 0 0116 0v3a2 2 0 002 2v1a2 2 0 01-2 2h-1.5a2.5 2.5 0 01-5 0h-3a2.5 2.5 0 01-5 0H6a2 2 0 01-2-2v-1a2 2 0 012-2V8z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  { icon: <PartnerIcon />, label: 'Meer dan 300 reispartners' },
  { icon: <ShieldIcon />, label: 'Laagste prijsgarantie' },
  { icon: <LockIcon />, label: 'Veilig boeken' },
  { icon: <SupportIcon />, label: '24/7 klantenservice' },
];

export function HomeFeatures() {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
      {features.map((feature) => (
        <div key={feature.label} className="flex items-center gap-2.5">
          {feature.icon}
          <span className="text-sm font-medium text-white">{feature.label}</span>
        </div>
      ))}
    </div>
  );
}
