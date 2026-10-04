import { LegalPageShell, OwnerLegalInput } from '@/components/consent/legal-page-shell';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookiebeleid | VacationWeb',
  description: 'Welke technologieën VacationWeb gebruikt en hoe je keuzes maakt.',
  robots: { index: true, follow: true },
};

const inventory = [
  {
    name: 'vacationweb-cookie-consent',
    type: 'localStorage',
    purpose: 'Bewaart jouw cookie-/toestemmingskeuze (versie, analytics, marketing, tijdstempel).',
    provider: 'VacationWeb',
    retention: 'Tot je de keuze wist of browserdata verwijdert',
    consent: 'Noodzakelijk (voorkeursopslag)',
  },
  {
    name: 'vacationweb.favorites.v1',
    type: 'localStorage',
    purpose: 'Lokale favorietenlijst (hotel, provider, prijs, bestemming, savedAt).',
    provider: 'VacationWeb',
    retention: 'Tot je favorieten wist of browserdata verwijdert',
    consent: 'OWNER/LEGAL INPUT OPEN — juridische kwalificatie',
  },
  {
    name: 'vacationweb.shared-search-state',
    type: 'sessionStorage',
    purpose: 'Tijdelijke zoekstatus (kan reisgezelschap bevatten voor de sessie: aantal volwassenen en leeftijden van kinderen, geen geboortedata).',
    provider: 'VacationWeb',
    retention: 'Tot het browsertabblad/sessie eindigt',
    consent: 'Noodzakelijk voor zoekflow',
  },
] as const;

export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookiebeleid">
      <p>
        Dit beleid beschrijft alleen technologieën die VacationWeb zelf gebruikt. Er zijn momenteel
        geen Google Analytics, GTM, Meta Pixel, Vercel Analytics of andere trackingpixels
        geïnstalleerd. Analytics en marketing staan technisch standaard uit en worden alleen na
        toestemming geladen wanneer die later worden geactiveerd.
      </p>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">Inventaris</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-[12.5px]">
            <thead className="bg-slate-50 text-[#0A2D62]">
              <tr>
                <th className="px-3 py-2 font-semibold">Naam</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Doel</th>
                <th className="px-3 py-2 font-semibold">Provider</th>
                <th className="px-3 py-2 font-semibold">Bewaartermijn</th>
                <th className="px-3 py-2 font-semibold">Toestemming</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={row.name} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-mono text-[11.5px]">{row.name}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">{row.purpose}</td>
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2">{row.retention}</td>
                  <td className="px-3 py-2">{row.consent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-slate-500">
          HTTP-cookies van VacationWeb zelf: geen vastgesteld. Externe cookies na clickout naar
          reisaanbieders/affiliate: <OwnerLegalInput label="partnercookie-gedrag na clickout" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">Jouw keuzes</h2>
        <p>
          Pas toestemming aan via{' '}
          <Link href="/cookie-settings" className="font-medium text-[#0A2D62] underline underline-offset-2">
            cookie-instellingen
          </Link>
          . Zie ook het{' '}
          <Link href="/privacy" className="font-medium text-[#0A2D62] underline underline-offset-2">
            privacybeleid
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
