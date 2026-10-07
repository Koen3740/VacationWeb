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
            als onderdeel van je zoekopdracht. Die leeftijden staan daarom in de zoek-URL, als{' '}
            <code className="font-mono text-[12.5px]">childAges=…</code>, en kunnen dus ook in je
            browsergeschiedenis en in technische serverlogs van de hosting voorkomen. VacationWeb
            vraagt in de reizigersinvoer geen namen, adressen of volledige geboortedata; volledige
            geboortedata vraagt VacationWeb niet als standaard zoekgegeven.
          </li>
          <li>
            Wanneer een reisaanbieder technisch een geboortedatum nodig heeft om een prijs of
            beschikbaarheid op te vragen, kan VacationWeb in de technische aanvraag en in de
            doorverwijzing naar die aanbieder een synthetische geboortedatum gebruiken (afgeleid uit
            de reisdatums en de opgegeven leeftijd). Dat is niet de geboortedatum van een reiziger.
            Een echte geboortedatum geef je, indien nodig, pas bij de reisaanbieder zelf op.
          </li>
          <li>
            Favorieten die je zelf opslaat: die blijven alleen in je browser en worden niet naar
            VacationWeb of derden gestuurd (zie het cookiebeleid).
          </li>
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
          VacationWeb gebruikt affiliate-links en kan een vergoeding ontvangen wanneer je via een
          link bij een reisaanbieder boekt. TradeTracker kan daarbij als affiliatenetwerk betrokken
          zijn. Met ‘Boeken’ ga je naar de website van de reisaanbieder. Vanaf dat moment gelden het
          privacy- en cookiebeleid van die aanbieder en, indien betrokken, van TradeTracker; zij
          kunnen zelf cookies plaatsen of lezen. VacationWeb vraagt geen naam, e-mailadres of
          account en stuurt die dus ook niet mee. De link kan wel reisgegevens van je zoekopdracht
          bevatten, zoals vertrekdatum en reisgezelschap; bij sommige aanbiedingen (nu Sunweb en
          Eliza was here bij een zoekopdracht met 4 reizigers in 2 kamers) staat het reisgezelschap
          als technische, synthetische geboortedata in die link, niet als leeftijden. Zoals bij elke
          link deelt je browser bij het openen technische gegevens (zoals je IP-adres) met de
          bestemmingssite. Exact partnergedrag (cookies na clickout) moet uit
          provider/TradeTracker-informatie worden bevestigd:{' '}
          <OwnerLegalInput label="affiliate/TradeTracker transparantie" />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#0A2D62]">5. Opslag</h2>
        <p>
          Favorieten en cookievoorkeuren kunnen lokaal in je browser worden bewaard. Zoekstatus kan
          tijdelijk in sessionStorage staan. Live-prijsresultaten kunnen tijdelijk in
          server-side cache/object storage staan. De technische cache-sleutel bevat geen
          geboortedatum, geen naam en geen gebruikers-ID of IP-adres; per kind bevat hij alleen een
          technische code die van de leeftijd is afgeleid.
        </p>
        <p>
          De pagina&apos;s met zoekresultaten en aanbiedingsdetails zijn ingesteld om niet door
          zoekmachines te worden geïndexeerd en om niet in een cache te worden opgeslagen.
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
          Zie het <Link href="/cookies" className="font-medium text-[#0A2D62] underline underline-offset-2">cookiebeleid</Link>. Je kunt je toestemming altijd wijzigen of intrekken via{' '}
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
