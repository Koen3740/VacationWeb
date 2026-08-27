import { FavoritesList } from '@/components/favorites/favorites-list';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import Link from 'next/link';

export default function FavorietenPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <ResultsSiteHeader />
      <main className="mx-auto max-w-[960px] px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0A2D62]">Favorieten</h1>
            <p className="mt-1 text-[14px] text-[#64748B]">
              Vakanties die je via het hartje hebt bewaard.
            </p>
          </div>
          <Link href="/results" className="text-[13px] font-medium text-[#0A2D62] hover:underline">
            Terug naar resultaten
          </Link>
        </div>
        <FavoritesList />
      </main>
    </div>
  );
}
