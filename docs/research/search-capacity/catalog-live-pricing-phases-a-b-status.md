# Catalogus + live pricing — fasestatus A/B (delta sinds Sub 18)

**Documenttype:** canonieke **actuele fasestatus** + delta-inventaris  
**Geschreven:** 2026-08-30  
**Scope:** uitsluitend documentatie van reeds uitgevoerde fasen A1–A2, B1–B4, B4 follow-up research, Sunweb/Eliza performance research  
**Geen** nieuwe code, benchmarks of provider-API-onderzoek in deze schrijfsessie

---

## 0. Vertrekpunt (aantoonbaar)

| Veld | Waarde |
|---|---|
| **Laatste gedocumenteerde research-status in deze map** | [`README.md`](./README.md) — **Sub 18 Search-capacity / Prijsvrij Receipt closeout**, datum **2026-08-21** |
| **Centrale Sub 18-samenvatting** | [`prijsvrij-receipt-capacity-final-consolidation.md`](./prijsvrij-receipt-capacity-final-consolidation.md) |
| **Productstand Sub 18 (ongewijzigd)** | Prijsvrij = **PARKED** voor interactieve Results-live-prijs; Receipt = enige bewezen eind-pp |
| **Niet aanwezig in deze repository** | *(opgelost 2026-08-30)* `provider-status-2026-08-17.md` is **hersteld** onder `docs/research/provider-landscape/`. Master Handbook Current staat buiten deze app-repo. |
| **Git-tracked `docs/vacationweb-*.md` blueprints** | Vroege fase-1 / “Corendon-first” architectuurvisie — **niet** de actuele multi-provider Results-runtime; zie §9 |

**Delta die dit document vastlegt:** alles sinds Sub 18-closeout dat in code + fase-rapporten aantoonbaar is (sessie **2026-08-30** en bijbehorende implementatie/researchartefacten).  
Sub 18-documenten blijven **historisch geldig** voor Prijsvrij Receipt-capaciteit; zij worden hier **niet** herschreven.

---

## 1. Fasestatus (actueel)

| Fase | Status | Kern |
|---|---|---|
| **A1** Catalogus shards + pre-load exclusie | **AFGEROND** | Geïmplementeerd + R2-cold gemeten |
| **A2** Verwijderen product-cap `RESULTS_USER_RESULTSET_MAX` | **AFGEROND** | Geïmplementeerd; >1000 → normale pagination |
| **B1** `contextItemId`-cache TTL 2 s | **AFGEROND** | Geïmplementeerd + unit tests |
| **B2** Lichter GUID/pricing-pad | **AFGEROND (onderzoek)** | Geen lichter pad; **geen** prod-implementatie |
| **B3** Inflight-dedup | **AFGEROND (evidence)** | Bestaande `joinOrStartInflight`; **geen** nieuwe dedup-laag |
| **B4** waitUntil-gates + Corendon KA/C + circuit | **AFGEROND** | Geïmplementeerd; keep-alive bench = stand-in |
| **B4 follow-up** Providervergelijking | **AFGEROND (research)** | Corendon was al snelst; bottlenecks Sunweb → Eliza |
| **Sunweb/Eliza perf research** | **AFGEROND (research)** | LIVE benches; **geen** prod-wijziging |
| **C** Homepage pre-fetch | **NIET GESTART** | Wacht op expliciete OK |
| Sunweb/Eliza C↑, TTL↑, GPP∥, verdere KA | **NIET GEÏMPLEMENTEERD** | Alleen research/hypothese |

---

## 2. Actuele architectuurantwoorden (checklist §6)

| # | Vraag | Antwoord |
|---|---|---|
| 1 | **Wat is actief?** | Runtime Results-catalogus: **Corendon, Sunweb, Eliza was here** via provider-shards. **Prijsvrij** blijft parked (shard mag op R2 staan; **niet** geladen in Results). Live pricing: page1 overlays + matchset via `waitUntil` (cache-warming). Corendon C=**8**; Sunweb/Eliza/Prijsvrij-pad C=**5**. B1 context-cache TTL **2 s**. Circuit breaker aan. |
| 2 | **Wat is onderzocht?** | B2 lichter pad; B4 gates; B4 follow-up vergelijking; Sunweb/Eliza C/KA/early-abort/GPP∥/context-stability/catalog-reuse; Sub 18 Prijsvrij Receipt (historisch). |
| 3 | **Wat is geïmplementeerd?** | A1 shards/parallel/pre-load-exclusie; A2 cap-verwijdering; B1 cache; B3 bewijs van bestaande dedup; B4 Corendon keep-alive + C=8 + circuit + observability. |
| 4 | **Wat is gemeten?** | A1 R2-cold 10 133 → 2 703 ms; B4 KA **1,73×** op **local HTTP stand-in**; Sunweb/Eliza LIVE breakdown/concurrency/early-abort/GPP/stability (zie artefacten). |
| 5 | **Hypothese?** | Verdere winst via Sunweb/Eliza C↑, TTL↑, GPP∥ — **gemeten in research**, niet product-proven onder prod-load. |
| 6 | **Afgwezen / negatief?** | Lichter GUID-endpoint (B2); stream early-abort als landing-optimalisatie (breekt keep-alive); shared pricing cache in B4; feed-€ als live. |
| 7 | **Nog open?** | Fase C; Sunweb/Eliza implementatie-optimalisaties; instance-hit % process-local cache; Master Handbook / provider-status-bestanden ontbreken in-repo. |
| 8 | **Eerstvolgende gate?** | Expliciete toestemming voor **volgende technische fase** (typisch: Sunweb/Eliza pricing-optimalisatie **of** Fase C) — **niet** automatisch starten. |

---

## 3. Delta A — Catalogus

### 3.1 Fase A1 — AFGEROND (geïmplementeerd)

**Code (verifieerbaar):**

- `lib/offers/catalog-shards.ts` — `RUNTIME_CATALOG_ACTIVE_PROVIDERS` = Corendon, Sunweb, Eliza; `excludeParkedProvidersFromStoredCatalog`; Prijsvrij **niet** actief.
- `lib/offers/load-runtime-dataset.ts` — parallel laden van alleen actieve shards; geen Prijsvrij-shard-I/O op Results-pad.
- Generation metadata: `catalogShards` op `current.json`; monolithische `catalogKey` blijft voor omkeerbaarheid.
- Compacte catalogus was al aanwezig; A1 voegt shard + pre-load-exclusie toe.

**R2-cold benchmark (echte R2 `loadOffers` / `loadRuntimeDataset`, Fase 0-rest → na A1):**

| | Baseline (Fase 0-rest) | Na A1 (mediaan 3 runs) |
|---|---:|---:|
| Cold `loadOffers` | **10 133 ms** | **2 703 ms** |
| Verbetering | — | **≈ −73%** (−7 430 ms) |
| Offers geladen | 76 760 (incl. Prijsvrij) | **9 646** actief (C 5639 / S 3306 / E 701) |
| Prijsvrij offers geladen | in monolith | **0** |

Bron: implementatie-rapport Fase A1 in agent-sessie 2026-08-30 (zelfde transcript als Sub 18-recovery). Label: **echte R2-cold catalogusload**, geen stub.

**Tests:** o.a. `lib/offers/catalog-shards.test.ts` (pre-load exclusie: geen `prijsvrij.json`-key).

### 3.2 Fase A2 — AFGEROND (geïmplementeerd)

- `RESULTS_USER_RESULTSET_MAX` / `isResultsResultsetOverLimit` **verwijderd** uit productpad (`lib/search/pagination.ts` bevat ze niet meer).
- `evaluateResultsResultsetLimit`: `overLimit` / `stoppedEarly` altijd `false`; geen product-cap; >1000 resultaten → **normale pagination** (geen refinement-guard op 1000).
- Live-pricing candidate window blijft **150** (`RESULTS_LIVE_PRICING_CANDIDATE_CAP`) — dat is **geen** user-resultset-max.
- Regressietests: `results-resultset-limit.test.ts`, `hero-departure-airport-flow.test.ts` asserten afwezigheid van de cap.

---

## 4. Delta B — Live pricing

### 4.1 Fase B1 — AFGEROND (geïmplementeerd)

| Item | Feit |
|---|---|
| Module | `lib/providers/context-item-id-cache.ts` |
| TTL | **`CONTEXT_ITEM_ID_CACHE_TTL_MS = 2_000`** (2 s) — code-verified |
| Scope | Per-acco `contextItemId` (Sunweb/Eliza); site GUIDs = process-local config, geen prijs-cache |
| Hit | Skip landing HTML binnen TTL; **live PromotedPrice blijft verplicht** |
| Miss / stale | Landing opnieuw; stale context → invalidate + verse landing |
| **Niet** | Live-prijs caching als vervanging; langere TTL (later research toont ≥1 h stabiliteit — **niet** geïmplementeerd) |
| Tests | `lib/providers/context-item-id-cache.test.ts` (TTL, hit/miss, stale, geen verkeerde prijs) |

### 4.2 Fase B2 — AFGEROND als onderzoek (geen implementatie)

Canonieke rapport: [`b2-lighter-pricing-path-report.md`](./b2-lighter-pricing-path-report.md) + `b2-lighter-pricing-path-probe.json`.

| Classificatie | Item |
|---|---|
| Onderzocht | HEAD, Accept-JSON, Range, SharedFilters, BookingGate, JSS guesses, GPP zonder context |
| Bewezen | **Geen** lichter bewezen endpoint; landing HTML blijft noodzakelijke GUID-bron binnen onderzochte routes |
| Afgwezen als productoplossing | Early-abort/stream-parse als “lichter pad” (niet bevestigd; later negatief t.o.v. keep-alive) |
| Geïmplementeerd | **Niets** (acceptatie: rapport “geen lichter pad” is voldoende) |

### 4.3 Fase B3 — AFGEROND als evidence (geen nieuwe laag)

| Item | Feit |
|---|---|
| Mechanisme | Bestaande `joinOrStartInflight` in `lib/providers/prijsvrij/page1-receipt-pricing.ts` |
| Providers | Sunweb, Eliza, Corendon (en Prijsvrij-pad) |
| Bewijs | Identieke gelijktijdige page1+matchset → **één** provider-call; verschillende occupancy keys → apart |
| Tests | `lib/providers/b3-inflight-dedup-evidence.test.ts` — **6/6** |
| Geïmplementeerd in B3 | **Geen nieuwe dedup-laag** — alleen tests/evidence |

### 4.4 Fase B4 — AFGEROND (geïmplementeerd + gates)

Canonieke rapporten: [`b4-waituntil-cache-gates.md`](./b4-waituntil-cache-gates.md), [`b4-completion-report.md`](./b4-completion-report.md).

| Item | Status | Code / evidence |
|---|---|---|
| waitUntil-gate V1 | **PASS** | `scheduleResultsMatchsetLivePricing` → `waitUntil(tracked)`; **alleen** matchset live-price **cache-warming**; muteert geen verzonden Response |
| Cache-architectuur V2 | Process-lokaal; **geen** shared pricing cache in B4; instance-hit % **ONBEKEND** | Gate-doc |
| Corendon keep-alive | **Geïmplementeerd** | `corendonIpv4HttpsAgent` (`keepAlive: true`) in `lib/http/prefer-ipv4.ts` |
| Corendon concurrency | **5 → 8** | `CORENDON_LIVE_PAGE1_CONCURRENCY` / `CORENDON_LIVE_MATCHSET_CONCURRENCY` = **8** |
| Sunweb / Eliza concurrency | **Ongewijzigd 5** | `SUNWEB_*` / `ELIZA_*` = **5** |
| Circuit breaker | **Geïmplementeerd** | `lib/providers/live-price-circuit.ts` (threshold 5, open 30 s); wired in `run*LiveIntoCache`; `circuit_open` observability |
| Keep-alive benchmark | **1,73×** offers/s | **Local HTTP stand-in** (live api-fe ECONNRESET) — **niet** productie Corendon-latency; `b4-corendon-keepalive-bench.json` |
| Shared pricing cache | **Niet** | Uitgesteld |
| Tests | o.a. `b4-orchestration-evidence.test.ts` | Zie completion-report |

### 4.5 B4 follow-up — AFGEROND (research only)

Canonieke rapport: [`b4-followup-provider-performance-comparison.md`](./b4-followup-provider-performance-comparison.md).

| Conclusie | Detail |
|---|---|
| B4 versnelde vooral **Corendon** (al snelste JSON-route) | Keep-alive + C=8 |
| Resterende bottlenecks | **Sunweb** (kritiek), daarna **Eliza** (landing ~0,7 MB + C=5) |
| Aanbevolen richting (niet geïmplementeerd) | Eerst Sunweb/Eliza C / landing-kosten; niet verder Corendon-first |

### 4.6 Sunweb / Eliza live-pricing performance research — AFGEROND (research only)

Canonieke rapport: [`sunweb-eliza-live-pricing-performance-research.md`](./sunweb-eliza-live-pricing-performance-research.md)  
Artefacten: `_sunweb_eliza_perf/` · harness `scripts/_research_sunweb_eliza_perf/run.mjs`

**Belangrijke gemeten / onderzochte punten (samenvatting — cijfers niet herzien):**

| Onderwerp | Uitkomst | Classificatie |
|---|---|---|
| Cold p50 chain (LIVE N=8) | Corendon ~**143 ms**; Eliza ~**624 ms**; Sunweb ~**1965 ms** | LIVE |
| Concurrency N=12 | Sunweb wall 3755→**1155 ms** @ C=8; Eliza best ~**C=10**; **0×429** | LIVE — **niet** in prod |
| Early-abort landing | GUID ~65% diep; abort **slechter** dan full+KA (reuse breekt) | LIVE — **afgewezen** als aanpak |
| Grouped ∥ GPP (Sunweb) | Prijzen matchen seq/par/reverse; latency-winst mogelijk | LIVE — **niet** geïmplementeerd |
| contextItemId stability | **12/12** stabiel t/m **1 h** | LIVE — prod TTL blijft **2 s** |
| Catalog acco-reuse | Sunweb multi-offer ~45% landings bespaarbaar bij once-per-acco | OFFLINE |
| Orchestratie 2B | Page1 overlays onafhankelijk; matchset/price-sort wall = traagste cohort | CODE |

---

## 5. Expliciet NIET gedaan (niet als geïmplementeerd beschrijven)

| Item | Status |
|---|---|
| Sunweb concurrency verhogen | Onderzocht (LIVE) — **niet geïmplementeerd** (blijft 5) |
| Eliza concurrency verhogen | Onderzocht (LIVE) — **niet geïmplementeerd** (blijft 5) |
| Langere `contextItemId` TTL | Stabiliteit ≥1 h gemeten — **TTL blijft 2 s** |
| Sunweb grouped/GPP parallelisatie | LIVE research — **niet geïmplementeerd** |
| Verdere Sunweb/Eliza connection-optimalisatie | Research/advies — **niet geïmplementeerd** |
| Homepage pre-fetch (**Fase C**) | **Niet gestart** |
| Shared / distributed live-price cache | Gate V2: uitgesteld |
| Prijsvrij opnieuw actief in Results | **Nee** — blijft PARKED |
| Feed-catalogusprijs als live weergave | Verboden / ongewijzigd beleid |

---

## 6. Provideronderscheid (geen vermenging)

| Provider | Catalogus Results | Live pricing C (prod) | B4 wijziging | Research-bottleneckrol |
|---|---|---|---|---|
| **Corendon** | Actief (shard) | **8** | Keep-alive + C↑ + circuit | Snelste cold chain; niet dominante matchset-wall |
| **Sunweb** | Actief (shard) | **5** | Alleen circuit (gedeeld) | **Kritieke** trage provider (3 hops + HTML) |
| **Eliza was here** | Actief (shard) | **5** | Alleen circuit | Tweede bottleneck (2 hops + HTML) |
| **Prijsvrij** | **Parked** — 0 offers geladen | Pad bestaat (C=5) maar niet in actieve Results-set | Circuit wired | Sub 18 Receipt-research; geen actieve Results-integratie |

Formulering zoals “providers zijn sneller gemaakt” is **onjuist** voor B4: alleen **Corendon** kreeg C/KA-wijzigingen.

---

## 7. Benchmark-labels (niet verwisselen)

| Meting | Label |
|---|---|
| A1 10 133 → 2 703 ms | **Echte R2-cold** catalogusload |
| B4 1,73× keep-alive | **Stand-in** local HTTP (geen live api-fe latency) |
| Sunweb/Eliza breakdown / C / early-abort / GPP / stability | **LIVE provider** (research harness) |
| Sub 18 price-API matrices | **Bestaand** research (vaak **zonder** landing bootstrap) |
| Catalog multi-offer reuse % | **OFFLINE** catalogusanalyse |

Nooit stubbed/stand-in als productie-Corendon-latency presenteren.

---

## 8. Cross-references (canonieke documenten)

| Onderwerp | Canoniek document |
|---|---|
| Deze fasestatus / delta A+B | **Dit bestand** |
| Sub 18 index / Prijsvrij Receipt | [`README.md`](./README.md), final consolidation |
| B2 | `b2-lighter-pricing-path-report.md` |
| B4 gates / completion | `b4-waituntil-cache-gates.md`, `b4-completion-report.md` |
| B4 follow-up | `b4-followup-provider-performance-comparison.md` |
| Sunweb/Eliza perf | `sunweb-eliza-live-pricing-performance-research.md` |

A1/A2/B1/B3 hebben geen aparte completion-markdown in-repo vóór deze consolidatie; hun status staat hier + in code/tests.

---

## 9. Historische documenten (niet vervalst)

| Document | Beleid |
|---|---|
| Alle Sub 18 Prijsvrij/search-capacity audits | **Intact laten** — historische evidence; PARKED-conclusie blijft geldig |
| `docs/vacationweb-technical-architecture-v1.md` e.d. | Vroege blueprint (“één feed Corendon”) — **historisch**; niet herschrijven als huidige runtime |
| Ontbrekende Delta 5 / provider-status | **Niet verzonnen**; gap gerapporteerd in §0 |

---

## 10. Code ↔ documentatie controle (2026-08-30)

| Claim | Code-check |
|---|---|
| `RESULTS_USER_RESULTSET_MAX` verwijderd | **OK** — niet in `pagination.ts`; tests asserten afwezigheid |
| Corendon C = 8 | **OK** — `lib/providers/corendon/constants.ts` |
| Sunweb / Eliza C = 5 | **OK** — respective `constants.ts` |
| contextItemId TTL = 2 s | **OK** — `CONTEXT_ITEM_ID_CACHE_TTL_MS = 2_000` |
| waitUntil warmed alleen pricing-cache / schedule | **OK** — `schedule-results-matchset-live-pricing.ts` + B4 tests |
| Actieve catalogusproviders excl. Prijsvrij | **OK** — `RUNTIME_CATALOG_ACTIVE_PROVIDERS` |
| Shared pricing cache | **Niet aanwezig** als B4-deliverable — **OK** |

Geen discrepantie gevonden op bovenstaande claims.

---

**STOP.** Geen Fase C. Geen Sunweb/Eliza-implementatie. Wacht op expliciete toestemming voor de volgende technische fase.
