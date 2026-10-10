import { DiscoveryMagazine } from '@/components/discovery/discovery-magazine';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { DESTINATIONS } from '@/content/destinations';
import { buildMagazine } from '@/lib/discovery/model';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Ontdek | VacationWeb',
  description: 'Plekken waarvan je niet wist dat ze zo mooi zijn. Elke week nieuw.',
};

export default function OntdekPage() {
  const magazine = buildMagazine(DESTINATIONS);
  return (
    <div className="min-h-screen bg-vw-bg font-vw-sans text-vw-ink">
      <ResultsSiteHeader appearance="results" activeKey="discover" />
      <main className="mx-auto max-w-vw-page px-4 pb-16 pt-4 min-[901px]:px-7">
        <div className="mb-4 flex flex-col gap-2 min-[901px]:flex-row min-[901px]:items-end min-[901px]:justify-between">
          <div>
            <h1 className="m-0 font-vw-serif text-[36px] font-medium leading-none text-vw-navy min-[901px]:text-[46px]">
              {magazine.title}
            </h1>
            <p className="mt-1.5 text-[15px] text-vw-muted">{magazine.lead}</p>
          </div>
          <span className="text-[12px] text-[#8a7a5c]">{magazine.updatedLabel}</span>
        </div>
        <DiscoveryMagazine magazine={magazine} />
        <footer className="mt-4 flex flex-wrap gap-[18px] border-t border-vw-line py-[22px] text-[13px] text-vw-muted">
          <span>© VacationWeb</span>
          <Link href="/privacy" className="hover:text-vw-navy">Privacybeleid</Link>
          <Link href="/cookies" className="hover:text-vw-navy">Cookiebeleid</Link>
          <Link href="/cookie-settings" className="hover:text-vw-navy">Cookie-instellingen</Link>
        </footer>
      </main>
    </div>
  );
}
