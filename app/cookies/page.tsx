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
    purpose: 'Lokale favorietenlijst: hotel, afbeelding, provider, prijs, bestemming en tijdstip van opslaan. Alleen in je browser; niet naar VacationWeb of derden gestuurd en niet gekoppeld aan een account.',
    provider: 'VacationWeb',
    retention: 'Tot je favorieten verwijdert of je browsergegevens wist',
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
  {
    name: 'vacationweb-lang',
    type: 'HTTP-cookie (eigen domein)',
    purpose: 'Onthoudt je taalkeuze (Nederlands of Français) op vacationweb.be. Bevat alleen de taalcode; geen tracking, niet gedeeld met derden. Niet gebruikt op vacationweb.nl.',
    provider: 'VacationWeb',
    retention: '12 maanden, of tot je browsergegevens wist',
    consent: 'Noodzakelijk (door jou gekozen taalvoorkeur)',
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
          HTTP-cookies van VacationWeb zelf: alleen vacationweb-lang (taalvoorkeur, alleen op vacationweb.be; zie inventaris). Na een klik op ‘Boeken’ ga je naar de
          website van de reisaanbieder; die en eventueel TradeTracker kunnen daar eigen cookies
          plaatsen of lezen, buiten het bereik van VacationWeb (zie hun cookiebeleid). Externe
          cookies na clickout naar reisaanbieders/affiliate:{' '}
          <OwnerLegalInput label="partnercookie-gedrag na clickout" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">Favorieten</h2>
        <p>
          Favorieten worden alleen in je browser opgeslagen. Ze worden niet naar VacationWeb of
          derden gestuurd en zijn niet gekoppeld aan een VacationWeb-account. Daarom zijn je
          favorieten niet automatisch beschikbaar op een ander toestel of in een andere browser. Ze
          blijven bewaard totdat je ze verwijdert of je browsergegevens wist.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">Jouw keuzes</h2>
        <p>
          Je kunt je toestemming altijd wijzigen of intrekken via{' '}
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
