import { LegalPageShell, OwnerLegalInput } from '@/components/consent/legal-page-shell';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacybeleid | VacationWeb',
  description: 'Hoe VacationWeb omgaat met persoonsgegevens en privacy.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacybeleid">
      <p>
        VacationWeb is een budget-first vakantievergelijkingswebsite. VacationWeb verkoopt zelf geen
        vakanties; je vergelijkt aanbiedingen en wordt voor een boeking doorgestuurd naar externe
        reisaanbieders (affiliate).
      </p>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">1. Verwerkingsverantwoordelijke</h2>
        <p>
          Juridische naam: <OwnerLegalInput label="juridische naam" />
        </p>
        <p>
          Adres: <OwnerLegalInput label="adres" />
        </p>
        <p>
          Privacy-contact: <OwnerLegalInput label="privacy-email" />
        </p>
        <p>
          DPO (indien van toepassing): <OwnerLegalInput label="DPO" />
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">2. Welke gegevens</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Zoekparameters (bestemming, datums, luchthaven, reisgezelschap).</li>
          <li>
            Aantal volwassenen en leeftijden van kinderen (een baby wordt uit de leeftijd afgeleid)
            als onderdeel van je zoekopdracht. Volledige geboortedata van reizigers vraagt
            VacationWeb niet als standaard zoekgegeven.
          </li>
          <li>
            Wanneer een reisaanbieder technisch een geboortedatum nodig heeft om een prijs of
            beschikbaarheid op te vragen, kan VacationWeb in de technische aanvraag en in de
            doorverwijzing naar die aanbieder een synthetische geboortedatum gebruiken (afgeleid uit
            de reisdatums en de opgegeven leeftijd). Dat is niet de geboortedatum van een reiziger.
            Een echte geboortedatum geef je, indien nodig, pas bij de reisaanbieder zelf op.
          </li>
          <li>Lokaal bewaarde favorieten in je browser (niet naar trackingdiensten gestuurd).</li>
          <li>Technische gegevens die je browser meestuurt bij het bezoeken van de site.</li>
        </ul>
        <p>
          Grondslagen en bewaartermijnen: <OwnerLegalInput label="grondslagen en bewaartermijnen" />
        </p>
        <p>
          Beoordeling verwerking van kindleeftijden en synthetische geboortedatum:{' '}
          <OwnerLegalInput label="kindleeftijd/synthetische DOB juridische beoordeling" />
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">3. Doeleinden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Zoeken, vergelijken en tonen van vakantieaanbiedingen.</li>
          <li>Doorsturen naar reisaanbieders / affiliatepartners voor boeking.</li>
          <li>Technische werking, beveiliging en foutopsporing van de website.</li>
          <li>
            Optioneel (alleen na toestemming en wanneer geactiveerd): analytics en/of marketing.
            Momenteel zijn er geen analytics- of marketingproviders geïnstalleerd.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">4. Externe partijen</h2>
        <p>
          Bij een klik naar een aanbieding kan je browser gegevens delen met de gekozen
          reisaanbieder en/of affiliate-infrastructuur (onder meer TradeTracker). Exact partnergedrag
          (cookies na clickout) moet uit provider/TradeTracker-informatie worden bevestigd:{' '}
          <OwnerLegalInput label="affiliate/TradeTracker transparantie" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">5. Opslag</h2>
        <p>
          Favorieten en cookievoorkeuren kunnen lokaal in je browser worden bewaard. Zoekstatus kan
          tijdelijk in sessionStorage staan. Live-prijsresultaten kunnen tijdelijk in
          server-side cache/object storage staan zonder geboortedatum in de
          cache-identiteit (kindleeftijden alleen als gehashte waarde).
        </p>
        <p>
          Juridische kwalificatie van favorieten-localStorage:{' '}
          <OwnerLegalInput label="kwalificatie vacationweb.favorites.v1" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">6. Jouw rechten</h2>
        <p>
          Afhankelijk van toepasselijk recht kun je rechten uitoefenen zoals inzage, rectificatie,
          verwijdering, beperking, bezwaar en dataportabiliteit. Contact:{' '}
          <OwnerLegalInput label="privacy-email" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">7. Cookies en instellingen</h2>
        <p>
          Zie het <Link href="/cookies" className="font-medium text-[#0A2D62] underline underline-offset-2">cookiebeleid</Link> en pas keuzes aan via{' '}
          <Link href="/cookie-settings" className="font-medium text-[#0A2D62] underline underline-offset-2">cookie-instellingen</Link>.
        </p>
      </section>

      <p className="text-[12.5px] text-slate-500">
        Dit document is een technische privacy-pagina. Het vervangt geen formeel juridisch advies.
        Velden gemarkeerd als OWNER/LEGAL INPUT OPEN moeten door de eigenaar/legal worden ingevuld.
      </p>
    </LegalPageShell>
  );
}
