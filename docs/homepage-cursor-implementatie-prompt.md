> **Niet Current / niet SSOT.** Officiële handleidingen staan uitsluitend in `C:\Users\koenm\Documents\VacationWeb\VacationWeb_Master_Handbook\Current\`. Dit bestand is repo-/projectcontext onder VacationWebNext. Zie PROJECT_LOG DOC-002.

﻿# VacationWeb — Homepage Cursor-implementatieprompt

Bronnen voor deze prompt: codebase `components/home/*` + `app/page.tsx`, Frontend Architecture (trust), `VacationWeb_Homepage_Content_and_Structure_Blueprint_v1.0`, `VacationWeb_Homepage_Actieplan_Besluitenregister_v1.1`. TravelHunter ≈74% mobiel = implementatiecontext (mobile-first), geen layout-kopie.

## A. Wat de homepage al goed doet
- Hero + search-structuur aanwezig (`HomeHero` + `HomeSearch`); H1-kern "Meer vakantie voor jouw budget".
- Shared search popups / Results-tokens (`RESULTS_*`) — design-coherentie.
- Trust-achtige USP-strip bestaat (`HomeFeatures`), compact onder search.
- Populaire bestemmingen + foto-kaarten (`HomePopularDestinations`, `HomePhotoCardLink`).
- "Waarom VacationWeb"-blok bestaat (nog te kort t.o.v. SSOT).
- Footer + cookie banner aanwezig.
- Geen Results/live-pricing-logica in homepage-pad.

## B. Wat concreet ontbreekt (t.o.v. Blueprint-volgorde)
1. Trust strip met de 4 vaste SSOT-teksten (nu andere USP-labels in `HomeFeatures`).
2. Compacte inspiratie ("Laat je inspireren" + redactionele teasers) — nu `HomeThemes` = "Vakantietypes", niet SSOT-inspiratie.
3. Zo werkt VacationWeb — 4 vaste stappen.
4. Goed om te weten — FAQ/accordions met de 6 vaste vragen.
5. Veilig boeken — vaste kernzin + genuanceerde uitleg (geen universele SGR-claim).
6. SEO-contentblok — "Vakantie vergelijken en inspiratie".
7. Populaire bestemmingen: SSOT wil 4 grote kaarten + headline "Waar wil je naartoe?" + CTA "Bekijk alle bestemmingen"; code heeft 5 kaarten + andere heading/copy; toont geen prijzen (goed).
8. Homepage-specifieke metadata/SEO (layout-metadata is generiek/verouderd t.o.v. hero-belofte).
9. Footer-IA wijkt af van SSOT-groepen/labels; veel links naar `/search` placeholders.

## C. Wat concreet moet worden aangepast
- Hero-subcopy: SSOT = "Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht." — code gebruikt "reispartners" + extra zin.
- Trust-strip labels → exacte 4 SSOT-statements.
- Sectievolgorde in `app/page.tsx` → Blueprint 1–10.
- Why-blok uitbreiden naar SSOT-subheadline + 5 value-punten (niet zoekproces herhalen).
- Themes-sectie vervangen/herpositioneren als compacte inspiratie (V1 redactioneel; geen dealsite).
- Nieuwe sectiecomponenten voor How-it-works / FAQ / Veilig / SEO.
- Mobile-first spacing/typografie; funnel: zoeken primair, rest ondersteunend.
- Metadata alignen met SSOT-belofte (zonder nieuwe claims).

## D. Herbruikbare componenten
- `HomeHero`, `HomeHeader`, `HomeSearch`, search icons/popups
- `HomePopularDestinations` + `HomePhotoCardLink` + `buildPopularDestinationHref`
- `HomeWhyVacationWeb` (inhoud herschrijven)
- `HomeFeatures` → hergebruik als Trust strip (copy + eventueel rename)
- `HomeFooter`, `HomeCookieBanner`, `HomeMobileNav`
- `RESULTS_*` design tokens
- Niet Results live-pricing / provider / matchset-code

## E. Bestanden die Cursor waarschijnlijk wijzigt
- `app/page.tsx` (sectievolgorde)
- `components/home/home-hero.tsx`
- `components/home/home-features.tsx` (trust SSOT)
- `components/home/home-popular-destinations.tsx`
- `components/home/home-themes.tsx` → inspiratie of nieuw `home-inspiration.tsx`
- `components/home/home-why-vacationweb.tsx`
- Nieuw: `home-how-it-works.tsx`, `home-good-to-know.tsx`, `home-safe-booking.tsx`, `home-seo-content.tsx`
- `components/home/home-footer.tsx` (IA/labels naar SSOT; geen fake routes verzinnen)
- Eventueel `app/layout.tsx` of homepage `metadata` — voorzichtig, sitebreed effect

---

# DEFINITIEVE CURSOR-PROMPT

Kopieer alles onder deze kop als Cursor-opdracht (of voer dit bestand uit als instructie).

---

# VACATIONWEB — HOMEPAGE IMPLEMENTATIE (Cursor)

Je werkt in de VacationWeb app-repo op de machine van de gebruiker:
`C:\Users\koenm\Documents\VacationWeb\VScode_vacationweb_app`

## Rol
Implementeer de afgesproken VacationWeb-homepage volgens SSOT. Dit is een IMPLEMENTATIE-opdracht, geen onderzoekstraject.

## Verplichte bronnen (lees eerst, read-only)
1. Code: `app/page.tsx`, `components/home/*`, `app/layout.tsx`, `components/results-v2/results-design-tokens.ts`
2. SSOT:
   - `C:\Users\koenm\Documents\VacationWeb\VacationWeb_Master_Handbook\Current\VacationWeb_Homepage_Content_and_Structure_Blueprint_v1.0.docx`
   - `C:\Users\koenm\Documents\VacationWeb\VacationWeb_Master_Handbook\Current\VacationWeb_Homepage_Actieplan_Besluitenregister_v1.1.docx`
3. Frontend Architecture (trust): homepage kernzin over bescherming — geen universele SGR+Calamiteitenfonds-claim.
4. Context (NIET kopiëren): TravelHunter-achtige benchmarks → ~74% mobiel ⇒ mobile-first; funnel zoeken→vergelijken→doorklikken; geen dealsite; geen optimalisatie op lange homepage-dwell.

SSOT/Besluitenregister wint altijd op teksten en sectievolgorde. Verzin geen nieuwe homepage-concepten.
Doe de gapanalyse NIET opnieuw — die staat hierboven (A–E). Ga na korte inspectie meteen bouwen.

## Harde verboden
- GEEN Results / live-pricing / provider / matchset / concurrency-code wijzigen.
- GEEN catalogus-/feedprijs als live/actuele prijs tonen.
- GEEN nieuwe claims (prijzen, reviews, aantallen, "populair" zonder data, universele bescherming).
- GEEN grote refactor, geen nieuwe architectuur, geen performance/C-onderzoek.
- GEEN TravelHunter-layout kopiëren.
- Waar SSOT-tekst bestaat: EXACT gebruiken (geen parafraseren).

## Doel
Breng de homepage in lijn met Blueprint-volgorde + vaste copy; mobile-first; funnelgericht; rustige premium VacationWeb-look (RESULTS tokens).

## Sectievolgorde (verplicht in `app/page.tsx`)
1. Hero + search
2. Trust strip
3. Populaire bestemmingen
4. Compacte inspiratie
5. Waarom VacationWeb?
6. Zo werkt VacationWeb
7. Goed om te weten
8. Veilig boeken
9. SEO-content
10. Footer
(+ bestaande cookie banner mag blijven zoals nu)

## Exacte SSOT-copy (niet wijzigen)

### Hero
- H1: Meer vakantie voor jouw budget.
- Sub: Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht.
- Zoekstructuur behouden (Bestemming/Land-Regio-Plaats, Wanneer, Reisduur, Luchthaven, Reizigers, CTA "Vakanties zoeken"). Geen budgetveld. Velden visueel evenwichtig; alleen CTA mag smallere/bredere uitzondering zijn.

### Trust strip (4 aparte statements)
1. 100% onafhankelijk
2. Vergelijk en vind de voordeligste vakantie
3. Getoonde prijzen zijn de prijzen van de aanbieder
4. Boek veilig en rechtstreeks bij de reisorganisatie
Compact onder de zoekmodule; geen lange paragrafen/grote kaarten.

### Populaire bestemmingen
- Headline: Waar wil je naartoe?
- Vier grote bestemmingskaarten (geen 5). Voorlopig bv. Spanje, Griekenland, Italië, Turkije — alleen namen met bestaand aanbod/beeld; geen prijzen/aantallen tenzij betrouwbare actuele data echt beschikbaar is (anders weglaten).
- CTA: Bekijk alle bestemmingen → bestaande `/bestemmingen` of documenteer als gap als route ontbreekt.

### Compacte inspiratie
- Headline: Laat je inspireren
- Intro: Kijk rond, ontdek nieuwe bestemmingen en vind een vakantie die bij je past.
- Compacte redactionele kaarten (bv. Mallorca, Rome, Toscane) met korte teaser + CTA zoals "Ontdek Mallorca".
- V1 redactioneel/statisch OK. Geen reisblog, geen dealsite. Bestaande `HomeThemes` ("Vakantietypes") mag verdwijnen of ondergeschikt worden — Blueprint-inspiratie heeft voorrang.

### Waarom VacationWeb?
- Headline: Waarom VacationWeb?
- Subheadline: Vergelijk meer. Kies beter.
- Punten (SSOT):
  - Eén keer zoeken, meerdere aanbieders vergelijken — vul je wensen één keer in en vergelijk passend aanbod.
  - Ontdek ook wat je zelf niet had gevonden — meerdere aanbieders naast elkaar kunnen vakanties, bestemmingen en mogelijkheden tonen die je anders mist.
  - Haal meer uit je budget — vergelijk vakanties, prijzen en mogelijkheden.
  - Echt onafhankelijk vergelijken — geen voorkeur voor één aanbieder.
  - Rechtstreeks boeken — na je keuze boek je rechtstreeks bij de aanbieder.
Niet opnieuw het zoekproces uitleggen (dat hoort in "Zo werkt").

### Zo werkt VacationWeb
Headline: Zo werkt VacationWeb
1. Kies een bestemming — Blader door landen, steden en reistypes voor inspiratie.
2. Vergelijk reizen — Bekijk de aanbieders en aanbiedingen die bij jouw reis passen.
3. Boek bij de aanbieder — Klik door en boek rechtstreeks bij de reisorganisatie.
4. Geniet van je reis — Pak je koffers en vertrek met een gerust hart.

### Goed om te weten
Headline: Goed om te weten
Intro: Alles wat je wilt weten voordat je gaat vergelijken.
FAQ/accordions (vragen exact):
- Hoe werkt VacationWeb?
- Boek ik bij VacationWeb?
- Zijn de prijzen op VacationWeb dezelfde als bij de aanbieder?
- Vergelijkt VacationWeb echt meerdere reisaanbieders?
- Waarom zou ik VacationWeb gebruiken als ik al weet waar ik wil boeken?
- Bij wie boek ik mijn vakantie?
Antwoorden: kort, waarheidsgetrouw, aligned met SSOT (vergelijken → doorklikken/boeken bij aanbieder; getoonde actuele prijzen = aanbiederprijzen wanneer live/proven — geen catalogus als live claimen). Geen lange FAQ-pagina-simulatie.

### Veilig boeken
Headline: Veilig boeken
Kernzin EXACT: Wij werken alleen met reisorganisaties met de nodige bescherming.
Korte uitleg: welke bescherming van toepassing is kan verschillen per land, juridische entiteit en type reis. Waar relevant tonen we de betreffende bescherming, bijvoorbeeld SGR of het Calamiteitenfonds.
GEEN logo's/labels van SGR/Calamiteitenfonds als universele claim. Alleen tonen als toepassing aantoonbaar is; anders alleen de kernzin + nuance.

### SEO-content
Headline: Vakantie vergelijken en inspiratie
Compact redactioneel blok over vakantie vergelijken / bestemmingen / reisaanbieders / VacationWeb — natuurlijk NL, geen keyword-stuffing, geen aparte "SEO-landingspage"-look.

### Footer (SSOT-IA; bestaande routes hergebruiken)
VacationWeb: Over VacationWeb · Hoe werkt het? · Veilig boeken · FAQ
Ontdek: Bestemmingen · Vakanties · Inspiratie · Aanbiedingen
Voor aanbieders: Voor reisorganisaties · Partner worden
Juridisch: Privacy · Cookiebeleid · Algemene voorwaarden · Disclaimer
Als een doelpagina nog niet bestaat: anker naar homepage-sectie (`#...`) of bestaande route (`/bestemmingen`, `/aanbiedingen`) — GEEN nep-contentpagina's verzinnen. Placeholder-links naar `/search` vermijden waar mogelijk; documenteer resterende gaps.

## Werkwijze (verplicht)
1. Inspecteer kort de bestanden hierboven (max noodzakelijk).
2. Implementeer alleen homepage-wijzigingen.
3. Hergebruik bestaande home-components + RESULTS tokens.
4. Mobile-first: bruikbaar op smalle viewports; touch-vriendelijke CTA; geen desktop-only grids zonder fallback.
5. Semantische HTML: één H1 in hero; logische H2 per sectie; lists/accordions accessible (button/aria).
6. SEO: verbeter homepage-relevante metadata waar veilig (title/description aligned met hero; `lang` behouden). Geen fake structured-data claims.
7. Visueel: rustig, zacht, premium; CTA `#89ACD3` / navy `#0A2D62` taal; geen agressieve dealsite.
8. Funnel: hero-search blijft primaire actie; overige secties ondersteunen instapproutes (zoeken / inspiratie / vertrouwen / uitleg / praktische vragen) zonder dwell te maximaliseren.

## Self-check na afloop (verplicht)
- Sectievolgorde 1–10 aanwezig?
- Alle verplichte SSOT-zinnen exact?
- Geen Results/provider/live-pricing diffs?
- Mobile layout ok (sm/md/lg)?
- Geen catalogus-als-live / geen universele beschermingsclaim?
- Run: typecheck/lint/relevante home tests die al bestaan; noteer resultaat.
- Korte manuele checklist van CTA's naar Results/`/bestemmingen`/`/aanbiedingen`.

## Eindrapport (verplicht)
- Gewijzigde bestanden
- Wat per bestand
- Welke secties geïmplementeerd
- Afwijkingen van SSOT (indien onvermijdelijk) + waarom
- Wat NIET kon
- Build/type/lint/test-resultaat

STOP wanneer homepage-implementatie + self-check klaar zijn. Geen verdere onderzoekscyclus.
