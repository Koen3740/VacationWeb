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

export function ResultsUspBar() {
  return (
    <div className="border-t border-[#DCE4EE] bg-[#EAF1F7]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:px-8">
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
