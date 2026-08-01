import {
  buildResultsPageHref,
  getResultsTotalPages,
  RESULTS_PAGE_DEFAULT,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';
import Link from 'next/link';

type ResultsPaginationProps = {
  params: SearchParams;
  totalResults: number;
};

const linkClassName =
  'inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700';

const disabledClassName =
  'inline-flex cursor-not-allowed items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400';

export function ResultsPagination({ params, totalResults }: ResultsPaginationProps) {
  const currentPage = params.page ?? RESULTS_PAGE_DEFAULT;
  const pageSize = params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  const totalPages = getResultsTotalPages(totalResults, pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Paginatie"
      className="mt-8 flex flex-wrap items-center justify-center gap-3"
    >
      {hasPrevious ? (
        <Link href={buildResultsPageHref(params, 1)} className={linkClassName}>
          Eerste
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Eerste
        </span>
      )}

      {hasPrevious ? (
        <Link href={buildResultsPageHref(params, currentPage - 1)} className={linkClassName}>
          Vorige
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Vorige
        </span>
      )}

      <span className="px-2 text-sm font-medium text-slate-600">
        Pagina {currentPage} van {totalPages}
      </span>

      {hasNext ? (
        <Link href={buildResultsPageHref(params, currentPage + 1)} className={linkClassName}>
          Volgende
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Volgende
        </span>
      )}

      {hasNext ? (
        <Link href={buildResultsPageHref(params, totalPages)} className={linkClassName}>
          Laatste
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Laatste
        </span>
      )}
    </nav>
  );
}
