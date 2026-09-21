const TRUST_ITEMS = [
  {
    label: 'Onafhankelijk',
    detail: 'Eerlijke vergelijking',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" stroke="#0A2D62" strokeWidth="1.5" />
        <path d="M9 12l2 2 4-4" stroke="#0A2D62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Actuele prijs',
    detail: 'Direct van de aanbieder',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="6" width="16" height="13" rx="2" stroke="#0A2D62" strokeWidth="1.5" />
        <path d="M8 6V5a2 2 0 012-2h4a2 2 0 012 2v1" stroke="#0A2D62" strokeWidth="1.5" />
        <path d="M8 13h8M8 16h5" stroke="#0A2D62" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Boek rechtstreeks',
    detail: 'Bij de reisorganisatie',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"
          stroke="#0A2D62"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Betrouwbaar & transparant',
    detail: 'Jij kiest, wij vergelijken',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" stroke="#0A2D62" strokeWidth="1.5" />
        <path
          d="M12 11.5c.8 0 1.4-.6 1.4-1.3S12.8 9 12 9s-1.4.5-1.4 1.2.6 1.3 1.4 1.3z"
          fill="#0A2D62"
        />
        <path d="M12 12.5v3" stroke="#0A2D62" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

export function HomeTrustStrip() {
  return (
    <section aria-label="Vertrouwen" className="bg-[#FBF6F0]">
      <div className="mx-auto flex min-h-0 w-[80vw] items-center px-4 py-3.5 sm:px-6 lg:min-h-[70px] lg:px-0 lg:py-0">
        <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center lg:justify-between lg:gap-4">
          {TRUST_ITEMS.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 lg:shrink-0">
              <span className="shrink-0 text-[#0A2D62]">{item.icon}</span>
              <div>
                <p className="text-[14px] font-semibold leading-tight text-[#0A2D62]">{item.label}</p>
                <p className="mt-0.5 text-[12px] leading-tight text-[#64748B]">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
