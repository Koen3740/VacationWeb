# Search Capacity & Price Research — Index (ACTUEEL SSOT-route)

**Research + fasestatus.**  
**Sub 18 (Prijsvrij Receipt) centrale samenvatting:** [`prijsvrij-receipt-capacity-final-consolidation.md`](./prijsvrij-receipt-capacity-final-consolidation.md)  
**Actuele catalogus + live-pricing fasestatus (A/B sinds Sub 18):** [`catalog-live-pricing-phases-a-b-status.md`](./catalog-live-pricing-phases-a-b-status.md)  
**Main Chat 3 overdracht (niet in deze repo):** `VacationWeb_Master_Handbook/Current/_VacationWeb_MainChat_Delta_5.md`

---

## Actueel sinds Sub 18 — Catalogus + live pricing (2026-08-30)

**Vertrekpunt van deze delta:** dit README-bestand / Sub 18-closeout **2026-08-21** (zie hieronder).  
**Canonieke delta + fasestatus:** [`catalog-live-pricing-phases-a-b-status.md`](./catalog-live-pricing-phases-a-b-status.md)

| Fase | Status |
|---|---|
| A1 shards / pre-load exclusie (R2-cold 10 133→2 703 ms) | **AFGEROND** |
| A2 `RESULTS_USER_RESULTSET_MAX` verwijderd | **AFGEROND** |
| B1 contextItemId-cache TTL 2 s | **AFGEROND** |
| B2 lichter pricing-pad | **AFGEROND (onderzoek: geen pad)** |
| B3 inflight-dedup evidence | **AFGEROND (geen nieuwe laag)** |
| B4 Corendon KA/C=8 + circuit + waitUntil-gates | **AFGEROND** |
| B4 follow-up providervergelijking | **AFGEROND (research)** |
| Sunweb/Eliza performance research | **AFGEROND (research; niet geïmplementeerd)** |
| **C homepage pre-fetch** | **NIET GESTART** |

**Actieve Results-providers:** Corendon, Sunweb, Eliza was here. **Prijsvrij = PARKED** (0 offers geladen).  
**Prod concurrency:** Corendon **8**; Sunweb/Eliza **5**.  
**Niet geïmplementeerd:** Sunweb/Eliza C↑, langere context-TTL, GPP∥, Fase C.

Fase-rapporten: [`b2-lighter-pricing-path-report.md`](./b2-lighter-pricing-path-report.md) · [`b4-waituntil-cache-gates.md`](./b4-waituntil-cache-gates.md) · [`b4-completion-report.md`](./b4-completion-report.md) · [`b4-followup-provider-performance-comparison.md`](./b4-followup-provider-performance-comparison.md) · [`sunweb-eliza-live-pricing-performance-research.md`](./sunweb-eliza-live-pricing-performance-research.md)

Sub 18 Prijsvrij Receipt-conclusies hieronder blijven **historisch en productrelevant** (PARKED / Receipt = eind-pp). Zij beschrijven **niet** de A/B catalogus+pricing-implementatie.

---

## Sub 18 — Final update (disambiguatie)

**Datum:** 2026-08-21  
**Status:** HISTORISCH CLOSEOUT voor **Prijsvrij Receipt / search-capacity research** — nog steeds de SSOT voor die track. Opgevolgd (niet vervangen) door catalogus/live-pricing fasestatus 2026-08-30 hierboven.

Deze map bevatte oorspronkelijk **Sub 18 Search-capacity / Prijsvrij Receipt** (augustus 2026). Dat is **niet** de Sub 18 offer-detail / mega-sidecar-slice.

- **Memory-verificatie (dashboard 2026-08-21):** VacationWeb Production Functions = **2 GB (2048 MB)**. Architectuurbeoordeling / OPEN voorwaarden / Sub 19: Internal Data Model v2.4 addendum C en Master Plan §8.1f. Overdracht Hoofdchat 3: `_VacationWeb_MainChat_Delta_5.md` (SUB 18 — DEFINITIEVE CLOSEOUT). **Let op:** dat Master Handbook-pad staat **niet** in deze repository-checkout.
- Prijsvrij blijft PARKED en mag niet worden gebruikt om de offer-detail-architectuur kunstmatig klein te definiëren. PARKED betekent niet dat toekomstige schaal voor Prijsvrij of andere providers genegeerd mag worden. **Actueel (2026-08-30):** Results laadt **0** Prijsvrij-offers (shard pre-load exclusie) — zie fasestatus-doc.
- Sub 18 Implementation (detail-store): **NIET UITGEVOERD**.

---

## Documenthiërarchie

```
RAW EVIDENCE → RESEARCH REPORT → THIS INDEX → FINAL CONSOLIDATION → DELTA 5 → productbeslissing
```

**Productbeslissing (2026-08-17, actueel):** Prijsvrij is **PARKED** voor verdere integratie in de interactieve Results-prijsarchitectuur. Receipt blijft de enige bewezen eind-pp (Bijbel v1.8); Search/Matrix blijven **geen** eindprijs. Deze map is **technische evidence**, geen bouwplan. Operationeel: Master Development Plan + `docs/research/provider-landscape/provider-status-2026-08-17.md`.

---

## Definities (niet door elkaar halen)

| Term | Betekenis |
|---|---|
| **first 10** | Tijd tot **10 USABLE** Receipts |
| **all ready** | Alle N kandidaten **afgerond** (wall) |
| **Page READY** | Absolute T=0-timestamp waarop pagina van 10 volledig READY is (**niet optellen**) |
| **N** | Totale resultaatset (tenzij “Prijsvrij N”) |
| **HTTP 200 / empty `{}`** | **≠** usable |
| **Search / Matrix** | **≠** bewezen eindprijs |
| **Receipt** | **=** bewezen eindprijsbron |

Volledige definitielijst: final consolidation §0.

---

## SSOT per onderwerp

| Onderwerp | Actueel document |
|---|---|
| **Catalogus + live pricing fasen A/B (lees eerst voor Results-runtime 2026-08-30+)** | [`catalog-live-pricing-phases-a-b-status.md`](./catalog-live-pricing-phases-a-b-status.md) |
| **Final consolidation Prijsvrij Receipt (Sub 18)** | [`prijsvrij-receipt-capacity-final-consolidation.md`](./prijsvrij-receipt-capacity-final-consolidation.md) |
| Prijsvrij IBE / price layers | `Productfeeds/Prijsvrij/Prijsvrij_IBE_Bijbel_v1.8_SSOT.md` |
| A. Receipt capacity/concurrency | [`prijsvrij-receipt-capacity-concurrency-audit.md`](./prijsvrij-receipt-capacity-concurrency-audit.md) |
| A2. Receipt N=10 live C=5/C=10 | [`prijsvrij-receipt-n10-capacity-audit.md`](./prijsvrij-receipt-n10-capacity-audit.md) |
| B. Matrix vs Receipt | [`prijsvrij-matrix-vs-receipt-price-audit.md`](./prijsvrij-matrix-vs-receipt-price-audit.md) |
| C. Search vs Receipt | [`prijsvrij-search-receipt-price-correlation.md`](./prijsvrij-search-receipt-price-correlation.md) |
| D. Search −2% | [`prijsvrij-search-minus2-receipt-audit.md`](./prijsvrij-search-minus2-receipt-audit.md) |
| E. Matrix ±2% | [`prijsvrij-matrix-plus2-receipt-audit.md`](./prijsvrij-matrix-plus2-receipt-audit.md), [`prijsvrij-matrix-minus2-receipt-audit.md`](./prijsvrij-matrix-minus2-receipt-audit.md) |
| F. Background Receipt capacity | [`prijsvrij-background-receipt-capacity-audit.md`](./prijsvrij-background-receipt-capacity-audit.md) |
| G. Page-progressive Receipt capacity (research; ≠ Package 2A SSR) | [`prijsvrij-page-progressive-receipt-capacity-audit.md`](./prijsvrij-page-progressive-receipt-capacity-audit.md) |
| Concentration top-10 / diversity X | [`prijsvrij-concentration-receipt-capacity-audit.md`](./prijsvrij-concentration-receipt-capacity-audit.md) |
| Clustered Search latency (Strategy D) | [`search-capacity-latency-audit.md`](./search-capacity-latency-audit.md) **§7A** |
| Clustered hit-rate vs ~35%-mythe | [`prijsvrij-clustered-vs-provider-price-integration-audit.md`](./prijsvrij-clustered-vs-provider-price-integration-audit.md) |

---

## Harde feiten (niet verliezen)

1. **Search `List[].Price` ≠ Matrix ≠ Receipt eind-pp.** Receipt = enige bewezen eind-pp.  
2. **Geen** bewezen universele vaste correctiefactor Search/Matrix → Receipt (±2% empirisch NO-GO).  
3. **Receipt N=10** @ C=5 ≈ **32,5 s** — **niet** ≤10 s. C=10 sneller maar timeouts.  
4. **Geen** provider-side Receipt bundling. Token reuse: ja. Primaire concurrency: **C=5**.  
5. Background: first-10 ~23–41 s voor N=50…300; **all** schaalt met N (tot ~499 s @ N=300).  
6. Page-progressive N=150 multi-provider: **73** Receipts; page READY = absolute T=0; page1=0 s was **0-PV in die set**.  
7. Empty/timeout Receipts kunnen page **never READY** maken — **geen** universele 10%-rate.  
8. Clustered **Search** kan N=100–300 snel; dat is **niet** Receipt.

---

## HISTORISCH / OBSOLETE (niet wissen)

| Document / claim | Status |
|---|---|
| “Honderden Receipt-prijzen zijn snel genoeg voor Search” | **OBSOLETE** productclaim |
| [`prijsvrij-progressive-page-receipt-capacity.md`](./prijsvrij-progressive-page-receipt-capacity.md) | **HISTORISCH** (berekend; claim “N=10 niet gemeten” is achterhaald) → zie n10 + page-progressive audits |
| Bijbel v1.7 als actuele SSOT | **HISTORISCH** → **v1.8** |
| Corendon “2839” als actuele BE-count | **HISTORISCH** → **2817** (XML 2026-08-14) |
| Delta 4 / V7 als leidende overdracht | **VERVANGEN** door **Delta 5** (4 + V7 alleen historisch) |

---

## OPEN producthypotheses (geen besluit)

- Page 1 max **3** Prijsvrij + page size 10 = **BESLIST** (Package 1 DONE; Master Plan §8.1a).  
- Search-N ≈ **150** / reserve-factor = **OPEN**.  
- Aanbevolen-rankingformule = **OPEN**.  
- Echte background/queue Receipt voor later pages = **OPEN**.  
  Package 2A (2026-08-15) = page-1 SSR/Suspense only (**GO WITH CONDITIONS**);
  niet dezelfde architectuur als deze page-progressive capacity-research.

---

## Harnesses

| Pad | Rol |
|---|---|
| `scripts/_sub17_prijsvrij_receipt_capacity/` | Concurrency + N=10 |
| `scripts/_sub17_prijsvrij_background_receipt/` | Background N=10…300 |
| `scripts/_sub17_prijsvrij_page_progressive/` | Page READY N=50/100/150 |
| `scripts/_sub17_prijsvrij_concentration_receipt/` | Top-10 concentration |
| `scripts/_sub17_prijsvrij_*_receipt_compare/` | Search/Matrix ±2% |
| `scripts/_sub18_search_capacity/` | Clustered Search latency |
