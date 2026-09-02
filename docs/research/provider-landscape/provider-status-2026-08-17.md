> **RECOVERY NOTE (2026-08-30):** Dit bestand ontbrak in de app-repo. Hieronder staat de **oorspronkelijke Write-payload** van 2026-08-17 (agent-transcript `12630261-830c-4214-b251-c3bf2ad1686e`, tool Write). Geen inhoudelijke herschrijving van de 17-08-status. Actuele Results-runtime (A1 shards / PV niet geladen): zie `VacationWeb_Master_Handbook/Current/VacationWeb_Master_Development_Plan.md` Current-update 2026-08-30.

# VacationWeb — Provider status (2026-08-17)

**Rol:** PRIMARY SSOT voor **actuele VacationWeb-providerstatus** na de audits van 15–17 augustus 2026.  
**Type:** research / productstatus. Geen nieuwe architectuur. Geen implementatie.  
**Niet:** de NL/BE unlock-path kaart van 11 augustus (`step-2-provider-landscape.md` — die blijft een landschapskaart).

**Operationele planning:** `VacationWeb_Master_Development_Plan.md` (handbook Current).  
**Technische providercontracten:** Bijbels onder `Productfeeds/` (ongewijzigd door parkeerbesluiten).  
**Canvases** (niet-handbook evidence): `gofun-nl-provider-audit`, `djoser-nl-provider-audit`, `sawadee-reizen-provider-audit` onder de Cursor canvases-map.

**PARKEREN ≠ niet bestaan. GEEN IMPLEMENTATIE NU ≠ definitief verwijderen.**

---

## 1. Actieve productie-scope (twee lagen)

### A. Runtime catalogus (wat `loadOffers()` nu kan tonen)

Bron: `config/feed-manifest.json` + importer-allowlist (`corendon | prijsvrij | sunweb | eliza`).  
Lokale catalogussnapshot 17-08-2026 (`data/offers.json`, **niet** live R2 gelezen in die audit): **77 675** offers — Prijsvrij **67 114** (86,4%), Corendon **5060**, Sunweb **4707**, Eliza was here **794**.

Er is **geen** providerfilter in `loadOffers()` / `filterOffers()`. Elke catalogusprovider kan Results binnenkomen.

### B. Bedoelde actieve Results-scope (product, 17-08-2026)

Productbeslissing (eigenaar, 17-08-2026 20:28): Prijsvrij **niet verder** ontwikkelen in de interactieve Results-prijsarchitectuur; de website mag daar **niet** van afhankelijk zijn.

**Bedoelde zonpakket-Results-providers:** Corendon · Sunweb · Eliza was here.

**OPEN (niet uitgevoerd):** runtime-uitsluiting van Prijsvrij uit de actieve offer-array. De inventory-audit stelde dat parkeren **uitsluiting uit de catalogus** vereist (anders blijft ranking/budget ~86% Prijsvrij). Die codewijziging is **niet** goedgekeurd/uitgevoerd in deze consolidatie.

---

## 2. Status per provider

| Provider | Status | Waarom | Bruikbare offers (bewezen) | Prijsprobleem | Technisch | Productmatig | Toekomst |
|---|---|---|---|---|---|---|---|
| **Corendon** | **ACTIVE** (feed + live) | Sub 17-1 GO; live `lowestpricesacco` gebouwd | Catalogusmerge **5060** (BE 2817 + NL 2853 XML 14-08-2026; overlap/dedupe **OPEN**) | Feed-€ mag niet als Results-€ tot `proven` + `lowestpricesacco` | Bijbel v0.1.5; host `corendon.be` / `corendon.nl` | Kern zonpakket | BE+NL import/dedupe OPEN |
| **Sunweb** | **ACTIVE** (catalogusprijs) | Sub 17-1 GO; 8 zonfeeds in manifest | Catalogus **4707** (lokale snapshot 17-08) | Live `GetPromotedPriceApi` **niet** in productieclient; catalogus-€ is presentable tot live failt | Bijbel v0.1.4 | Kern zonpakket | Live-client later; geen blocker voor site zonder Prijsvrij |
| **Eliza was here** | **ACTIVE** (feed + live) | Sub 17-1 GO; `GetPromotedPriceApi` gebouwd | Catalogus **794** | Feed-€ niet tonen tot `proven` + `getPromotedPrice` | Bijbel v0.1.2 | Kern zonpakket | — |
| **Prijsvrij** | **PARKED** (product); code/catalogus **nog aanwezig** | Receipt = enige juiste eind-pp, maar te traag voor interactieve Results; Search/Matrix ≠ Receipt | Catalogus **67 114** (lokaal); **niet** als interactieve prijsbron | Receipt median ~**8,5 s**; N=150 all-ready ~**291 s**; Search vs Receipt n=480: 68,5% Search hoger; Matrix MAE ~€40,5 **NO-GO** | Bijbel **v1.8**; Package 1/2A historisch DONE | Website **niet** afhankelijk van Prijsvrij; geen nieuwe Receipt-workaround | Heropenen alleen bij snelle, betrouwbare route naar **juiste Receipt-prijs** |
| **GoFun.nl** | **GO kleine mapping, NIET geïmplementeerd** | 91 concrete zonpakketten; Corendon-achtige XML + `lowestpricesacco` met host **`www.gofun.nl`** | **91** feedrecords = 91 hotels/varianten | Feed p.p. meestal = live (5/6); 1/6 steekproef −€11; zonder live-gate niet in Results | **Niet** importeren als Corendon; aparte host | Volume klein t.o.v. Corendon; technisch kansrijk | Implementatietiming **OPEN** |
| **Traveldeal** | **PARKED** | Dealcatalogus, geen gedateerd zonpakket | Datafeed **1893**; Algemeen-feed **1** cruise (uitsluiten); oudere `data/traveldeal.xml` **1823** | `<price>` aanwezig maar semantiek (p.p. vs totaal) **ONBEKEND**; `fromPrice` 0.00 | Geen `departureDate`; geen numerieke duur; `returnDate` = deal-expiry | Zou datumfilter lekken; prijs onvergelijkbaar | Alleen bij andere feed of apart deals-oppervlak |
| **VacanceSelect** (TT **Vacanceselect**) | **PARKED** | Camping/park/resort (European Camping Group), geen vliegpakket-Results | Algemeen-feed **1433**; **1419× €0.00**; velden scrambled | Feed onbruikbaar als prijscatalogus; sitekaart = XML-allocatie **vanaf**, niet boekingsprijs | Geen Corendon-achtige IBE; TT-feed broken | PD-012 (VacationSelect/accommodatie) blijft; 17-08-audit bevestigt camping-OTA | Andere feed/vertical later; **niet** huidige Results |
| **Djoser** | **PARKED** (huidige Results) | Groepsrondreis, niet zonpakket-Results | Feed **244** programma’s; 242/244 vertrekdatum in het verleden (17-08); variations collapsed | Feedprijs ≠ live vanaf (0/4 samples); live vanaf + toeslagen | Geen JSON search; OTIS HTML IBE ~**5,8 s** | Incompatibel met land/plaats/luchthaven/7–8 nachten | Eventuele rondreis-vertical later |
| **Sawadee Reizen** | **PARKED** (huidige Results) | Groepsrondreis / familie / 22-35 / wandel / fiets; **0** zonpakket | **218** programma’s; **2350** toekomstige vertrekken; live catalogus **234** | Vanafprijs ≈ min live (LCK/MRC) maar ≠ eerste IBE-datum; AND-case €1749 vs IBE €1799 | `/Ajax/GetPriceCalculatorData` ~50 ms **per datum**, geen batch | Geen hotel+IATA+plaats zonpakket | Mogelijke toekomstige rondreis-vertical |
| **Cheaptickets** | buiten scope | 1 vluchtregel | **1** | n.v.t. | geen pakketcatalogus | — | — |
| **Transavia Holidays** | buiten scope | 4 verlopen 2025-rijen | **4** | n.v.t. | te klein / verlopen | — | — |
| **Corendon.com** | buiten pakket-merge | vluchten, geen zonpakket-merge met BE/NL | **105** | n.v.t. | Delta 5 | — | — |

---

## 3. GoFun — twee niet-tegenstrijdige lagen

| Datum | Artefact | Conclusie | Status |
|---|---|---|---|
| 2026-08-14 | `gofun-feed-audit.md` + Delta 5 | 91 reizen; travel-key overlap Corendon BE∪NL = **0/91**; soft naam 73/91 → **geen materiële catalogusuitbreiding**; “niet prioriteren” | **HISTORISCH** als *volume vs Corendon*; feedcounts blijven geldig |
| 2026-08-17 | canvas `gofun-nl-provider-audit` | Zelfde 91 rijen = concrete zonpakketten; live `lowestpricesacco` host `www.gofun.nl`; **GO MET KLEINE MAPPING**; niet als Corendon importeren | **ACTUEEL** technisch oordeel; **niet geïmplementeerd** |

---

## 4. Prijsvrij — waarom PARKED (niet herontwerpen)

Evidence-SSOT latency/semantiek: `docs/research/search-capacity/` + Delta 5 + Bijbel v1.8.

- Catalogusprijs / `minimum_price` ≠ gebruikerseindprijs.
- Search `List[].Price` ≠ Matrix ≠ Receipt. Receipt = `ceil(TotalInclLocal/(Adults+Children))`.
- Wachten op 150 Receipts (~291 s wall @ C=5) is onaanvaardbaar voor interactieve Results.
- `waitUntil` / background houdt de isolate in leven; het lost **niet** de UX van “user wacht op Receipt” op als de request-path die calls nog doet.
- Process-local live-price cache (TTL 8 h, occupancy key 2A/0C/0B/1 room) dempt herhaalde calls **binnen hetzelfde Node-proces**, niet cross-isolate / eerste koude user.
- Package 1 (page 1 = 10, max 3 PV, cap ≤10, C=5, `page1Ids`) en Package 2A (SSR/Suspense) blijven **historisch DONE** — geen nieuwe Prijsvrij-Results-architectuur bouwen.
- Owner 17-08-2026: geen nieuwe Receipt-loop, geen extra 150-pool/50-PV-limiet/background-prewarm **als Prijsvrij-workaround**.

De **algemene** Results-cap `RESULTS_USER_PAGINATION_CAP = 150` (user-paginatie + price-sort live-pool) is **geen** “wacht op 150 Receipts”. Zie Search Architecture.

---

## 5. Naamsverwarring VacanceSelect

| Label | Betekenis | Status 17-08-2026 |
|---|---|---|
| **VacationSelect** (PD-012) | In oudere docs: accommodatieplatform, buiten MVP | PD-012 blijft Actief |
| **Vacanceselect / VacanceSelect** | TT-feed + live campingmerk VacanceSelect Travel | PARKED voor huidige zonpakket-Results |

Search Architecture v2.9 noemde Vacanceselect ten onrechte een “pakketreis-leverancier”. Dat is **SUPERSEDED** door de 17-08-audit.

---

*Einde provider-status 2026-08-17. STOP — documentation only.*

---

## CURRENT RUNTIME NOTE (2026-08-30) — niet de 17-08-historie herschrijven

De secties hierboven blijven de **17-08-2026** audit/productstand.

**Sindsdien geïmplementeerd (A1, code-verified):** Results-runtime laadt alleen
`RUNTIME_CATALOG_ACTIVE_PROVIDERS` = **Corendon, Sunweb, Eliza was here**.
Prijsvrij wordt **vóór I/O** uitgesloten (**0** offers geladen). Dat sluit de
historische §1B-“OPEN: runtime-uitsluiting” voor Results.

**Ongewijzigd t.o.v. 17-08 product:** Prijsvrij blijft **PARKED** voor verdere
interactieve Results-integratie (PD-015). GoFun / Traveldeal / VacanceSelect /
Djoser / Sawadee blijven buiten actieve Results tenzij nieuw besluit.

**Operationele SSOT na A1:** Master Development Plan Current-update 2026-08-30 +
Search Architecture Current-update + dit bestand (17-08 + deze note).
