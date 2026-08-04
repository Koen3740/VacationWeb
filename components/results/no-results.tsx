import Link from 'next/link';

export function NoResults() {
  return (
    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Geen vakanties gevonden</h2>
      <p className="mt-2 text-sm text-slate-600">
        Er zijn geen aanbiedingen die passen bij je huidige filters. Pas je filters aan of start een nieuwe zoekopdracht.
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
