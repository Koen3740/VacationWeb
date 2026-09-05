# Autoproducten / rondreisclassificatie — productsemantiek SSOT

**Datum:** 2026-09-05  
**Type:** CURRENT productsemantiek + onboardingcontrole (geen architectuur-herbouw)  
**Procedure-SSOT:** `VacationWeb_Provider_Integration_Protocol` (Current) + extract  
`data/_current_doc_extract/VacationWeb_Provider_Integration_Protocol_v1.0_amended.txt`  
**Code-spiegel (niet Results-filter):** `lib/offers/fly-drive-rondreis.ts`  
**Huurauto-flag (apart):** `lib/offers/has-car-rental.ts` / `offer.hasCarRental`

---

## 1. VacationWeb-concepten (blijven gescheiden)

| Concept | Betekenis | Runtime vandaag |
|---|---|---|
| **Huurauto** | Pakket bevat bewezen autohuur | `offer.hasCarRental === true`; UI-filter “Autohuur inclusief” (`hasCarRental=1`) |
| **Fly & Drive (rondreis/rondtrekken)** | Provider-specifieke rondreis/rondrit-aanduiding waar bewezen | Semantiek hieronder; helper `isProvenFlyAndDriveRondreis` — **niet** aangesloten op Results-filtering |

Deze twee zijn **niet** hetzelfde. Huurauto bewijst **niet** dat iets een rondreis is.

---

## 2. A. BEWEZEN PROVIDERREGELS

### Corendon

| Product | Classificatie |
|---|---|
| **Fly & Drive** (providerbenaming op product) | **Rondreis / rondrit** |
| **Fly & Go** (= vlucht + huurauto bij één accommodatie/hotel) | **Geen** rondreis; hoort bij huurauto-pakket |
| Subcategorie-token `Fly-Drive vakantie` | Alleen **huurauto-import** (`hasCarRental`); **geen** universeel rondreisbewijs (dekt ook Fly & Go) |

Bewezen offer-niveau rondreis-signaal (huidige catalogus): product-/hotelnaam met providerbenaming **Fly & Drive** (bijv. catalogusnamen in `data/filter-options.json`: “Fly & Drive Chalkidiki”, “Fly & Drive Madeira”).  
**Niet** gebruiken: `hasCarRental === true` alleen.

### Sunweb

| Product | Classificatie |
|---|---|
| Door Sunweb aangeduid als **Fly & Drive** | **Rondreis / rondtrekken** |
| Gewone huurauto (`hasCarRental` zonder Fly & Drive-benaming) | **Geen** rondreis |

**Niet** gebruiken: `hasCarRental === true` als synoniem voor rondreis.

### Eliza was here

- De **productfeed** bevat **geen** rondreis-/rondritproducten.
- Een rondrit/rondreis kan **op aanvraag** worden samengesteld — dat is **geen** feed-/catalogusproduct.
- Daarom: **geen** feedclassificatie als rondreis.
- Eliza Flight → `hasCarRental` (productregel) blijft **gewone huurauto**, geen rondreis.

---

## 3. B. NIET GELDIG ALS UNIVERSELE REGEL

Verboden generalisaties:

1. `hasCarRental === true` ⇒ rondreis  
2. “Fly & Drive” bij provider X ⇒ automatisch dezelfde mapping bij provider Y  
3. Corendon/Sunweb-terminologie stilzwijgend overnemen voor nieuwe providers (o.a. Vakanties.nl)

Providerterminologie moet **per provider** worden onderzocht, bewezen en in de Provider-Bijbel vastgelegd.

---

## 4. C. NOG TE ONDERZOEKEN — o.a. Vakanties.nl

Bij onboarding van **Vakanties.nl** (eerstvolgende kandidaat voor deze controle) expliciet onderzoeken — **zonder aannames**:

1. Hoe noemt Vakanties.nl gewone huurauto’s?
2. Bieden zij “Fly & Drive” aan, of een andere naam voor rondreis/rondrit?
3. Worden huurauto en rondreis structureel onderscheiden?
4. Welk bronveld / categorie / producttype / ander signaal is beschikbaar?
5. Is dat signaal betrouwbaar genoeg voor VacationWeb-classificatie op offerniveau?
6. Negatieve voorbeelden (gewone huurauto mag niet als rondreis landen)?

Status: **OPEN — nog niet bewezen. Niets invullen op naamgelijkenis.**

Zelfde checklist geldt voor **iedere** toekomstige reisprovider (zie §5).

---

## 5. Onboardingcontrole — “Autoproducten / rondreisclassificatie”

Verplicht bij **elke** nieuwe reisprovider (zie Protocol Phase 2 / acceptance matrix):

1. Heeft de provider gewone huurauto-producten?
2. Heeft de provider rondreizen/rondritten?
3. Welke exacte providerbenaming gebruikt de provider?
4. Is “Fly & Drive” een provider-specifieke naam?
5. Is “Fly & Drive” bij deze provider daadwerkelijk een rondreis?
6. Welke bronvelden, categorieën, subcategorieën, producttypes of andere structurele signalen bewijzen dit?
7. Hoe wordt gewone huurauto onderscheiden van rondreis?
8. Kan de classificatie betrouwbaar op offer/productniveau worden uitgevoerd?
9. Zijn er negatieve voorbeelden die voorkomen dat gewone huurauto’s verkeerd als rondreis worden geclassificeerd?
10. Zijn er provider-specifieke uitzonderingen?
11. Mapping naar VacationWeb: **Huurauto** vs **Fly & Drive (rondreis/rondtrekken)**

Hard:

- `hasCarRental` is **geen** universeel bewijs voor rondreis.
- Terminologie mag **niet** automatisch van een andere provider worden overgenomen.

---

## 6. Huidige code vs semantiek (bewust ongemoeid)

| Laag | Gedrag | Oordeel t.o.v. deze SSOT |
|---|---|---|
| `hasCarRental` import | Corendon: token `Fly-Drive vakantie` + flight; Sunweb: Flight + feed-flag; Eliza: Flight | Correct voor **huurauto**; dekt Corendon Fly & Go én Fly & Drive voor de auto-flag |
| Results-filter `hasCarRental=1` | Alleen `offer.hasCarRental === true` | Correct; geen rondreis-synoniem |
| `vacationTypes=Fly & Drive` | Keyword-match op `offerSearchText` (o.a. `fly-drive`, `fly & drive`) | **Kan** Corendon Fly & Go meenemen via subcategorie `Fly-Drive vakantie` — **niet** identiek aan bewezen rondreis-SSOT |
| `isProvenFlyAndDriveRondreis` | Provider-bewezen naam-signaal; Eliza altijd false | Documenteert SSOT; **niet** wired in `filterOffers` |

### Open productbesluit (UI)

Gewenste semantiek in producttaal: **Huurauto** vs **Fly & Drive (rondreis/rondtrekken)**.  
Of/wanneer de Results vacation-type-filter strikt op bewezen rondreis moet filteren (en Fly & Go moet uitsluiten) is een **apart productbesluit**. In deze taak: **geen** Results-filterwijziging (zou match counts wijzigen).

### Hard stop

Geen heuristiek voor providers zonder bewezen signaal. Ontbreekt een betrouwbaar bronveld → classificatie blijft `false` / UNKNOWN tot bewijs in Provider-Bijbel.

---

## 7. Regressiebescherming

Wijzigingen onder deze SSOT mogen zoekresultaten, match counts, pricing, provider activation en gerelateerde Results-pijplijnen **niet** stilzwijgend wijzigen. Filter-wiring van rondreis vraagt een expliciet productbesluit.
