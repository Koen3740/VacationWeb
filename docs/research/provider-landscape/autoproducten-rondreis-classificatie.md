# Autoproducten / Roadtrip (Fly & Drive) vs Huurauto — productsemantiek SSOT

**Datum:** 2026-09-05 (forensics + filter wiring)  
**Type:** CURRENT productsemantiek + Results-filter + onboardingcontrole  
**Procedure-SSOT:** Provider Integration Protocol extract  
`data/_current_doc_extract/VacationWeb_Provider_Integration_Protocol_v1.0_amended.txt`  
**Code:** `lib/offers/fly-drive-rondreis.ts`, `lib/search/vacation-type.ts`, `lib/search/filtering.ts`

---

## 1. VacationWeb-concepten (onafhankelijk)

| Concept | UI-label | Runtime |
|---|---|---|
| **Roadtrip** | `Roadtrip (Fly & Drive)` | `vacationTypes=Fly & Drive` → `isRoadtripOffer` |
| **Huurauto** | `Huurauto inbegrepen` | `hasCarRental=1` → `offer.hasCarRental === true` |

Geen overkoepelende categorie “Auto”. Beide opties staan direct onder elkaar in Results (“Wat zoek ik?”).

Filters zijn **onafhankelijk** (AND bij beide actief). Een Roadtrip mag óók `hasCarRental === true` hebben.

---

## 2. Oorzaak oude “Fly & Drive”-classificatie (bewezen)

Voorheen matchte `vacationTypes=Fly & Drive` op **keyword** in `offerSearchText` (`fly-drive`, `fly & drive`, …).

Corendon-subcategorie **`Fly-Drive vakantie`** staat in die blob en dekt **Fly & Go** / gewone huurauto-pakketten.

Lokale catalogusaudit (active providers Corendon/Sunweb/Eliza, `data/offers.json`):

| Set | Aantal |
|---|---|
| Oude keyword “Fly & Drive” | **590** |
| Keyword ∩ `hasCarRental` | **577** |
| Verschil (keyword zonder car) | **13** |
| **Bewezen Roadtrip** (naam `Fly & Drive`, Corendon/Sunweb) | **29** |
| Roadtrip ∩ huurauto | **16** |
| Roadtrip zonder `hasCarRental` | **13** |
| Alle `hasCarRental` | **1316** |
| Keyword false positives (subcat `Fly-Drive vakantie`, geen Roadtrip-naam) | **561** (allen Corendon) |

Hypothese UI ≈595 / ≈579 / verschil 16: **richting-correct, niet exact** op deze snapshot (lokaal 590 / 577 / **13**). Het getal **16** = Roadtrip∩huurauto, **niet** het verschil keyword−intersectie. Geen hardcoding van 16.

Eliza: 701 offers, allen `hasCarRental`, **0** Roadtrip.

---

## 3. A. BEWEZEN PROVIDERREGELS

### Corendon
- **Fly & Drive** in product-/hotelnaam → **Roadtrip**.
- **Fly & Go** → geen Roadtrip (huurauto-pakket).
- Token `Fly-Drive vakantie` → alleen huurauto-import; **geen** Roadtrip.

### Sunweb
- Productnaam **Fly & Drive** → **Roadtrip**.
- Gewone `hasCarRental` zonder die benaming → geen Roadtrip.

### Eliza was here
- Geen Roadtrip in productfeed; aanvraag ≠ catalogusproduct.
- Huurauto blijft huurauto.

---

## 4. B. NIET UNIVERSEEL

- `hasCarRental === true` ⇒ Roadtrip — **verboden**.
- Elke tekst “fly drive” in lange copy ⇒ Roadtrip — **verboden**.
- Corendon/Sunweb-mapping stilzwijgend naar andere providers — **verboden**.

---

## 5. C. NOG TE ONDERZOEKEN — Vakanties.nl

Expliciete open onboardingcontrole (geen aannames). Zie Protocol Phase 2 checklist.

---

## 6. Onboardingcontrole — Autoproducten / Roadtrip

Bij iedere nieuwe provider (Protocol):

1. Gewone huurauto-producten?
2. Rondreizen/roadtrips?
3. Exacte providerbenaming?
4. Gebruikt “Fly & Drive”?
5. Betekent dat bij deze provider een rondreis?
6. Welke bronvelden/categorieën bewijzen dat?
7. Onderscheid huurauto vs Roadtrip?
8. Negatieve voorbeelden (false positives)?
9. Kunnen Roadtrip en huurauto tegelijk true zijn?
10. VacationWeb-mapping: Huurauto vs Roadtrip (Fly & Drive)?

Hard: `hasCarRental` ≠ universeel Roadtrip-signaal; terminologie per provider bewijzen.

---

## 7. Facets / counts

`countRoadtripFacet` / `countCarRentalFacet`: catalogus-listable, **niet** afhankelijk van live pricing, sort of pagination.
