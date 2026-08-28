import Link from 'next/link';

export function ResultsRefinementRequired() {
  return (
    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Maak je zoekopdracht iets specifieker</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
        Je zoekopdracht levert meer vakanties op dan we overzichtelijk kunnen presenteren. Kies
        bijvoorbeeld een bestemming, beperk je reisperiode of geef een reisduur op. Zo kunnen we je
        de meest relevante vakanties tonen.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Pas zoekopdracht aan
      </Link>
    </div>
  );
}
