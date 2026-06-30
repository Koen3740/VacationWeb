# VacationWeb Phase 1 bouwplan

## 1. Doel van Phase 1

Phase 1 levert een werkende VacationWeb-versie op die uitsluitend data uit één bron gebruikt: Corendon.

De eerste versie moet in een redelijke tijd aan deze kernvereisten voldoen:
- Corendon-feed verwerken
- vakanties opslaan
- vakanties doorzoekbaar maken
- filters ondersteunen
- resultaten tonen
- affiliate links ondersteunen

Phase 1 is een functionele MVP, geen volledig platform. Alles wat niet nodig is voor een eerste werkende versie wordt expliciet uitgesteld.

---

## 2. Scope van Phase 1

### 2.1 In scope voor Phase 1
- Eén feedbron: Corendon
- Eén data-ingest flow
- Opslag van hotels, offers en prijzen
- Zoek- en filterfunctionaliteit op offers
- Resultatenpagina met lijstweergave
- Detailpagina per offer
- Affiliate-link ondersteuning
- Basis-SEO voor publieke pagina’s
- Basis-admin flow om feed te laden en opnieuw te verwerken

### 2.2 Uit scope voor Phase 1
- meerdere aanbieders
- meerdere feeds tegelijk
- personalisatie
- gebruikersaccounts
- wishlists
- reviews en rating-content van gebruikers
- uitgebreide contentmarketingpagina’s
- complexe vergelijkingsengine
- AI-recommendaties
- CMS voor redactie
- uitgebreide affiliate orchestration
- geavanceerde analytics dashboards

---

## 3. Welke onderdelen gebouwd worden

| Onderdeel | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Corendon feed ingestie | Hoog | Feedbronaccess, dataformaat, opslag | Medium | Zonder feed is er geen databron |
| Data normalisatie en mapping | Hoog | Feed formaat, canonical model | Medium | De feed moet naar een consistent model worden gebracht |
| Database-opzet voor offers en hotels | Hoog | Data model, migration setup | Medium | Basis voor opslag en zoek |
| Search index voor offers | Hoog | Database, zoekengine setup | Medium | Search is een kernfunctionaliteit |
| Zoekpagina en resultatenpagina | Hoog | Search API, filter logic, UI components | Medium | Dit is de kernervaring |
| Detailpagina per offer | Hoog | Offer API, affiliate link data, UI | Low tot medium | Nodig voor clickthrough en affiliate doel |
| Affiliate link support | Hoog | Provider data, deeplink model | Low | Essentieel voor commercie |
| Basis SEO metadata | Medium | Page structure, metadata model | Low | Nodig voor publieke zichtbaarheid |
| Admin-import trigger | Medium | Feed worker, API endpoint | Low | Vereenvoudigt testen en herimport |

---

## 4. Welke onderdelen nog NIET gebouwd worden

| Onderdeel | Prioriteit | Reden voor uitstel |
|---|---|---|
| Meerdere feeds tegelijk | Laag | Te complex voor eerste release |
| Matchen van hotels tussen aanbieders | Laag | Vereist meer datakwaliteit en dedup-logica |
| Content hubs en blog | Laag | Geen kernfunctionaliteit voor eerste versie |
| Gebruikersaccounts | Laag | Niet nodig om vakantie te tonen of te vergelijken |
| Personalisatie | Laag | Te veel extra complexity zonder basisflow |
| Volledige CMS | Laag | Kan later worden toegevoegd zodra dataflow werkt |
| Advanced ranking model | Laag | Basis sorteren is genoeg voor MVP |
| Realtime prijsupdates | Laag | Periodieke refresh is voldoende in fase 1 |
| Multi-language support | Laag | Niet noodzakelijk voor eerste release |

---

## 5. Database-tabellen die eerst nodig zijn

| Tabel | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| providers | Hoog | Geen | Laag | Bevat de aanbieder, in dit geval Corendon |
| feeds | Hoog | providers | Laag | Registreert welke feed actief is |
| countries | Hoog | Geen | Laag | Nodig voor bestemming en filtercontext |
| regions | Hoog | countries | Laag | Ondersteunt regionale zoek- en filterlogica |
| destinations | Hoog | regions, countries | Laag | Kern voor zoek en SEO |
| hotels | Hoog | destinations, countries | Medium | Hotels zijn de basisentiteit voor offers |
| offers | Hoog | hotels, providers, feeds | Medium | Hoofdentiteit voor zoekresultaten |
| offer_prices | Hoog | offers | Low | Slaat prijsupdates op en maakt geschiedenis mogelijk |
| affiliate_links | Hoog | providers, offers | Low | Ondersteunt affiliate redirects |
| import_jobs | Medium | feeds | Low | Traceerbaarheid van ingest en fouten |
| data_quality_issues | Medium | offers, import_jobs | Low | Helpt bij fouten in de feed |

### Minimale data model-strategie
Phase 1 gebruikt een relatief eenvoudig maar robuust model:
- één provider
- één feed
- één offer per hotel/package combinatie per vertrekperiode
- eenvoudige prijshistorie
- duidelijke opslag van externe identifiers

---

## 6. API's die eerst nodig zijn

| API | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| POST /api/admin/feeds/import | Hoog | Feed worker, import jobs | Medium | Maakt het mogelijk om feed te laden en te testen |
| GET /api/search/offers | Hoog | Search service, filters, database/search index | Medium | Kern voor resultatenpagina |
| GET /api/offers/[id] | Hoog | Offer storage, affiliate link data | Low | Detailpagina moet data kunnen ophalen |
| GET /api/seo/page-data | Medium | Page metadata, content model | Low | Ondersteunt SEO metadata |
| POST /api/affiliate/redirect | Medium | Affiliate links, offer lookup | Low | Toont en gebruikt affiliate deeplink |
| GET /api/admin/import-jobs | Medium | import_jobs | Low | Debugging en monitoring |

### API-principes voor Phase 1
- eenvoudige REST endpoints
- duidelijke read/write scheiding
- basis validatie
- geen complexe GraphQL nodig

---

## 7. Pagina's die eerst gebouwd worden

| Pagina | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Homepage | Hoog | Search form, SEO metadata | Medium | Eerste instappunt en entry flow |
| Zoekpagina | Hoog | Search form, landing content | Low | Helpt gebruikers te starten met zoeken |
| Resultatenpagina | Hoog | Search API, filters, sorting | Medium | Kern van de productervaring |
| Offer detailpagina | Hoog | Offer API, affiliate CTA | Medium | Nodig voor clickthrough |
| 404 pagina | Medium | Basis routing | Low | Basiskwaliteit |

### Minimale paginaprioriteit
Phase 1 richt zich op vier publieke kernpagina’s. Andere inhoudspagina’s volgen later.

---

## 8. Pagina's die later komen

| Pagina | Prioriteit | Reden voor uitstel |
|---|---|---|
| Bestemmingspagina | Laag | Vereist meer inhoud en SEO-structuur |
| Landpagina | Laag | Niet nodig voor eerste functionele zoekervaring |
| Thema-/vakantiepagina | Laag | Kan later worden opgebouwd met geaggregeerde content |
| Blog en FAQ | Laag | Content-first en niet noodzakelijk voor MVP |
| Vergelijkingspagina | Laag | Complexer en niet essentieel voor de eerste release |
| Gebruikersdashboard | Laag | Geen gebruikersaccounts in fase 1 |

---

## 9. Componenten die eerst gebouwd worden

| Component | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Search form | Hoog | Search state, URL params | Medium | Startpunt van zoekflow |
| Filter panel | Hoog | Search API, filter state | Medium | Essentieel voor nuttig zoeken |
| Results list | Hoog | Offer cards, pagination | Medium | Toont de kernresultaten |
| Offer card | Hoog | Offer data, price display | Low | Basisweergave van een resultaat |
| Offer detail header | Hoog | Offer API | Low | Toont hotel, bestemming, prijsinformatie |
| Affiliate CTA button | Hoog | Offer data, redirect link | Low | Essentieel voor conversie |
| Loading en empty states | Medium | API state | Low | Verbeteren UX en robuustheid |
| SEO head component | Medium | Page metadata | Low | Basis SEO |

---

## 10. Feedverwerking die eerst gebouwd wordt

| Stap | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Feed ophalen | Hoog | Feed URL, scheduling | Low | Start van de dataflow |
| Feed parser | Hoog | Feed formaat | Medium | Vereist om brondata leesbaar te maken |
| Mapping naar canoniek schema | Hoog | Data model | Medium | Dit maakt de data bruikbaar |
| Validatie van verplichte velden | Hoog | Canonical model | Low | Verkoopt alleen complete offers |
| Opslaan van raw feed snapshot | Medium | Storage layer | Low | Helpt bij debugging en replay |
| Opslaan van offers in database | Hoog | Database model | Medium | Bron voor zoek en weergave |
| Basis deduplicatie | Medium | External IDs | Low | Vermijdt dubbele offers |
| Update search index | Hoog | Search service | Medium | Maakt offers vindbaar |

### Fase 1 feedstrategie
De eerste feedpipeline is intentionally simpel:
- één feedbron
- één parse-flow
- één mapping naar een consistent schema
- één dagelijkse of handmatige refresh

Geen complexe provider-specific routing of multi-feed orchestration in fase 1.

---

## 11. Zoekfunctionaliteit die eerst gebouwd wordt

| Functionaliteit | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Zoek op bestemming, hotel, land | Hoog | Search index | Medium | Basis zoekintentie |
| Filter op prijs | Hoog | Search fields, API | Medium | Kern van budgetfocus |
| Filter op board type | Hoog | Search fields | Medium | Veelgebruikte vakantiefilter |
| Filter op aantal nachten | Hoog | Search fields | Medium | Kern voor vakantieplanning |
| Filter op sterren | Medium | Search fields | Low | Extra bruikbaarheid |
| Filter op vertrekperiode | Hoog | Search fields, date handling | Medium | Essentieel voor vakanties |
| Sortering op prijs | Hoog | Search query logic | Low | Helpt users budget te vergelijken |
| Paginering | Medium | Result set size | Low | Nodig voor grote datasets |

### Fase 1 zoekscope
De zoekengine hoeft in fase 1 niet perfect te zijn. Ze moet voldoende goed zijn om:
- relevante offers terug te geven
- filters snel te laten werken
- resultaten logisch te sorteren

Geavanceerde ranking, fuzzy search en semantic matching komen later.

---

## 12. SEO-functionaliteit die eerst gebouwd wordt

| Functionality | Prioriteit | Afhankelijkheden | Geschatte complexiteit | Waarom in fase 1 |
|---|---|---|---|---|
| Titels en meta descriptions | Hoog | Page templates | Low | Basis SEO voor publieke pagina’s |
| Canonical URLs | Hoog | Routing | Low | Vermijdt duplicate content |
| Basis structured data | Medium | Offer and page data | Medium | Helpt zoekmachines beter te begrijpen |
| Sitemap | Medium | Page discovery | Low | Essentieel voor indexering |
| Robots.txt | Medium | Hosting config | Low | Basis indexeercontrole |
| Breadcrumbs | Medium | Page hierarchy | Low | Verbeteren navigatie en SEO |

### Fase 1 SEO-scope
Phase 1 doet geen uitgebreide contentstrategie. De focus ligt op:
- zoekmachinevriendelijke publieke pagina’s
- duidelijke URL-structuur
- basis metadata
- indexeerbaarheid van offers en zoekresultaten

---

## 13. Phase 1 implementatievolgorde

1. Data model en database-opzet
2. Corendon feed importer en parser
3. Opslag van offers en prijzen
4. Search index en zoek API
5. Frontend zoekflow: homepage, zoekpagina, resultatenpagina
6. Offer detailpagina en affiliate CTA
7. SEO metadata en sitemap
8. Testing, fixen van edge cases en stabilisatie

---

## 14. Phase 1 – concrete deliverables

### Deliverables van Phase 1
- werkende feed import voor Corendon
- database met hotels, offers en prijzen
- doorzoekbare offerlijst
- filters voor budget, board type, nachten, vertrekperiode
- resultatenpagina met offers
- detailpagina per offer
- affiliate-link support
- basis SEO voor publieke pagina’s

### Definition of done voor Phase 1
Phase 1 is afgerond wanneer:
- een echte Corendon-feed kan worden geladen
- offers zichtbaar zijn in de database
- gebruikers een zoekactie kunnen uitvoeren
- filters werken op een relevante set offers
- resultaten worden getoond in een begrijpelijke lijst
- een detailpagina open kan gaan met een affiliate CTA

---

## 15. Phase 2

### Doel van Phase 2
Phase 2 maakt VacationWeb schaalbaarder en beter bruikbaar dan een eenvoudige zoekpagina.

### Wat in Phase 2 komt
- meerdere feeds en meerdere aanbieders
- betere deduplication en matching
- betere ranking en relevantie
- meer SEO-pagina’s zoals bestemmings- en landpagina’s
- contentpagina’s en landingpages
- admin dashboard voor data quality en feed health
- caching en performance optimalisatie

### Waarom Phase 2 later komt
Deze onderdelen zijn waardevol, maar niet noodzakelijk voor het eerste werkende platform.

---

## 16. Phase 3

### Doel van Phase 3
Phase 3 maakt VacationWeb een volwassen, schaalbaar en commercieel sterker platform.

### Wat in Phase 3 komt
- geavanceerde personalisatie
- meer aanbieders en internationale coverage
- geavanceerde vergelijkingsfuncties
- AI-ondersteunde zoek of trip planning
- uitgebreid contentplatform en editorial flows
- sterke analytics, attribution en revenue tooling

### Waarom Phase 3 later komt
Deze functionaliteit is belangrijk voor groei, maar pas zinvol wanneer de kern van data, search en offers stabiel werkt.

---

## 17. Belangrijkste principe: niet te veel tegelijk bouwen

VacationWeb moet niet worden gebouwd als een platform dat in één keer alle ambities van een volledig reisbedrijf moet dekken.

De juiste volgorde is:
1. data verzamelen
2. data opslaan
3. data doorzoekbaar maken
4. resultaten tonen
5. affiliate functionaliteit leveren
6. daarna content en schaal uitbreiden

Deze volgorde geeft een realistische en beheersbare route naar een eerste werkende versie.
