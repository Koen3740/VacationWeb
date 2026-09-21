/**
 * Mockup SSOT — Waarom VacationWeb? three columns, consumer tone.
 */

const PILLS = [
  {
    title: 'Eenvoudig vergelijken',
    body: 'Vul je wensen één keer in en zie passende vakanties van meerdere aanbieders naast elkaar.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="7" height="14" rx="1.5" stroke="#0A2D62" strokeWidth="1.4" />
        <rect x="14" y="5" width="7" height="14" rx="1.5" stroke="#0A2D62" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    title: 'Scherpe prijzen',
    body: 'Actuele aanbiedingen zodat je meer vakantie krijgt voor hetzelfde budget.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.5" stroke="#0A2D62" strokeWidth="1.4" />
        <path d="M12 7.5v9M9.5 9.5c.6-.8 1.5-1.2 2.5-1.2 1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2c1 0 1.9-.4 2.5-1.2" stroke="#0A2D62" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Rechtstreeks boeken',
    body: 'Na je keuze boek je veilig en rechtstreeks bij de reisorganisatie die jij kiest.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 12h12M12 7l5 5-5 5" stroke="#0A2D62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 6v12" stroke="#0A2D62" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

export function HomeValuePills() {
  return (
    <section id="waarom" className="bg-[#F7F5F1]">
      <div className="mx-auto max-w-[1320px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            Waarom VacationWeb?
          </p>
          <h2
            className="mt-2 text-[1.85rem] font-semibold tracking-tight text-[#0A2D62] sm:text-[2.1rem]"
            style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
          >
            Waarom VacationWeb?
          </h2>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {PILLS.map((pill) => (
            <li key={pill.title} className="text-center">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center text-[#0A2D62]">
                {pill.icon}
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-[#0A2D62]">{pill.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-[#64748B]">{pill.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
