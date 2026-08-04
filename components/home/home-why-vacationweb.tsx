const KEY_POINTS = [
  'Onafhankelijke vergelijking',
  'Meerdere reispartners vergelijken',
  'Meer vakantie voor jouw budget',
  'Boeken doe je rechtstreeks bij de reispartner',
] as const;

export function HomeWhyVacationWeb() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-5 lg:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-10">
        <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#0A2D62] sm:text-[32px]">
          Waarom VacationWeb
        </h2>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-slate-600">
          VacationWeb is een onafhankelijke vakantievergelijker. Je doorzoekt één overzicht en
          kiest daarna een aanbod dat bij je past.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:gap-5">
          {KEY_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A2D62]/10 text-sm font-bold text-[#0A2D62]"
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="text-[16px] leading-relaxed text-slate-700 sm:text-[17px]">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
