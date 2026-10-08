/** Exact Prijsvrij-style max-150 copy. Do not add sentences. */
export const RESULTS_BROWSE_CAP_TITLE =
  'We kunnen je helaas maar maximaal 150 resultaten tonen';

export const RESULTS_BROWSE_CAP_BODY =
  'Gebruik de filters aan de linkerkant om je zoekopdracht te verfijnen en zo jouw top vakantie te vinden.';

export function ResultsRefinementRequired() {
  return (
    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{RESULTS_BROWSE_CAP_TITLE}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
        {RESULTS_BROWSE_CAP_BODY}
      </p>
    </div>
  );
}
