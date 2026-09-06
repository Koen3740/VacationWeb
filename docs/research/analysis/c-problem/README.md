# C-problem — historical analysis index

This directory logs **already executed** Cursor/research analyses that relate to VacationWeb live-pricing **C** (technical failure: not provider-confirmed unavailable A, not proven live price B).

No new runtime measurement was performed for this logging pass.

## Historical inventory

| ID | Analyse/rapport | Datum | Bron | Onderwerp | Status |
|----|-----------------|-------|------|-----------|--------|
| C01 | Search-capacity / latency audit (N=50–300, C=1/5/10/20) | 2026-08-13 | `docs/research/search-capacity/search-capacity-latency-audit.md` | Capacity/latency; C=20 harness | VOLLEDIG RAPPORT GEVONDEN |
| C02 | Prijsvrij Receipt concurrency (incl. C=20) | 2026-08-14 | `docs/research/search-capacity/` Receipt-docs | Receipt wall/usable vs concurrency | VOLLEDIG RAPPORT GEVONDEN |
| C03 | B4 circuit_open + technical TTL | 2026-08-30 | `docs/research/search-capacity/b4-*.md` | `circuit_open` as C-reason | VOLLEDIG RAPPORT GEVONDEN |
| C04 | Sunweb/Eliza L0 + L1 C=8 canary | 2026-08-30 | `_sunweb_eliza_perf/l0-baseline.json`, `l1-sunweb-c8.json` | `network_error` vs concurrency | VOLLEDIG RAPPORT GEVONDEN |
| C05 | Sunweb `network_error` root cause | 2026-08-31 | `sunweb-network-error-root-cause-report.md` | Connect timeout vs app timeout | VOLLEDIG RAPPORT GEVONDEN |
| C06 | Eliza transport / keep-alive vs `stale_context` | 2026-08-31 | `_sunweb_eliza_perf` Eliza transport docs | Transport vs application C | VOLLEDIG RAPPORT GEVONDEN |
| C07 | Spain 292 full-matchset A/B/C + retry | 2026-09-05 | `.test-out/forensics-full-matchset-abc-report.json` | Window 150 vs full; retry recovery | VOLLEDIG RAPPORT GEVONDEN |
| C08 | C-density & clustering | 2026-09-06 12:50Z | Temp `vw-c-density/c-density-report.json` | C-rate, clustering, sample | VOLLEDIG RAPPORT GEVONDEN |
| C09 | Catalog → Results survival + C cache | 2026-09-06 17:38Z | Temp `vw-survival-audit/survival-report.json` | Funnel + occupancy cache | VOLLEDIG RAPPORT GEVONDEN |
| C10 | 300-offer latency + retry-2 | 2026-09-06 20:19Z | Temp `vw-latency-retry/latency-retry-report.json` | Last B vs retry-2 | VOLLEDIG RAPPORT GEVONDEN |
| C11 | Results 150-window 8,1 s / 33,9 s | onbekend | geen meetbestand gevonden | first 10 / full window | NIET TERUGGEVONDEN |
| — | L2 t/m L8 Sunweb/Eliza ladders | — | L1-besluit: niet uitgevoerd | hogere concurrency | NIET TERUGGEVONDEN |
| — | Greece “4 gevonden / 3 kaarten” | 2026-09-06 | chat/forensic (A=`invalid_price`) | A-dropout, geen C-census | NIET ALS C-ANALYSE GELOGD |

Logbestanden:

| ID | Bestand |
|----|---------|
| C01 | [2026-08-13-c-search-capacity-latency-audit.md](./2026-08-13-c-search-capacity-latency-audit.md) |
| C02 | [2026-08-14-c-prijsvrij-receipt-capacity-concurrency.md](./2026-08-14-c-prijsvrij-receipt-capacity-concurrency.md) |
| C03 | [2026-08-30-c-b4-circuit-open-observability.md](./2026-08-30-c-b4-circuit-open-observability.md) |
| C04 | [2026-08-30-c-sunweb-eliza-l0-l1-network-error.md](./2026-08-30-c-sunweb-eliza-l0-l1-network-error.md) |
| C05 | [2026-08-31-c-sunweb-network-error-root-cause.md](./2026-08-31-c-sunweb-network-error-root-cause.md) |
| C06 | [2026-08-31-c-eliza-transport-keepalive.md](./2026-08-31-c-eliza-transport-keepalive.md) |
| C07 | [2026-09-05-c-spain-292-full-matchset-abc.md](./2026-09-05-c-spain-292-full-matchset-abc.md) |
| C08 | [2026-09-06-c-density-clustering.md](./2026-09-06-c-density-clustering.md) |
| C09 | [2026-09-06-c-catalog-results-survival.md](./2026-09-06-c-catalog-results-survival.md) |
| C10 | [2026-09-06-c-300-offer-latency-retry.md](./2026-09-06-c-300-offer-latency-retry.md) |
| C11 | — |

Per analyse hieronder: wat onderzocht werd, belangrijkste meetresultaat, beperkingen.

## C01 — Search-capacity latency (2026-08-13)

- **Onderzocht:** price-only enrichment N=50–300 @ concurrency 1/5/10/20 per provider.
- **Belangrijkste resultaat:** C=20 was een **historische harness-configuratie**, niet de latere Results-productie (8/5/5).
- **Beperkingen:** geen A/B/C-productclassificatie; Prijsvrij Receipt niet in deze matrix.

## C02 — Prijsvrij Receipt concurrency (2026-08-14)

- **Onderzocht:** Receipt wall/usable bij C=2/5/10/20 en N=50–300.
- **Belangrijkste resultaat:** C=20 verkortte wall tot ~25 s maar verhoogde timeouts / volatile usable.
- **Beperkingen:** Prijsvrij Receipt-pad; Prijsvrij later PARKED voor interactieve Results.

## C03 — B4 circuit_open (2026-08-30)

- **Onderzocht:** circuit breaker + `circuit_open` als ERROR/C-reason.
- **Belangrijkste resultaat:** threshold 5 technical failures, open 30 s; `circuit_open` short TTL, niet retryable.
- **Beperkingen:** Corendon live bench faalde (ECONNRESET); KA-cijfers = local HTTP stand-in.

## C04 — L0 / L1 Sunweb network_error (2026-08-30)

- **Onderzocht:** Sunweb N=24 L0 C=5 vs L1 C=8.
- **Belangrijkste resultaat:** L0 C=5: 4× `network_error`, wall 10333 ms. L1 C=8: 14× `network_error`, wall 21699 ms. Canary **niet** geaccepteerd.
- **Beperkingen:** N=24; intermittent; L2+ niet uitgevoerd op dit bewijs.

## C05 — Sunweb network_error root cause (2026-08-31)

- **Onderzocht:** wat `network_error` technisch is.
- **Belangrijkste resultaat:** `UND_ERR_CONNECT_TIMEOUT` (~10 s) op landing TCP naar `www.sunweb.be`, niet 15 s AbortSignal.
- **Beperkingen:** production catch discardt exception details.

## C06 — Eliza transport (2026-08-31)

- **Onderzocht:** Eliza connect timeouts vs `stale_context`.
- **Belangrijkste resultaat:** `stale_context` = application/data; connect-failures = transport/intermittent.
- **Beperkingen:** keep-alive was canary/research; C=8 niet gebruikt.

## C07 — Spain 292 A/B/C (2026-09-05)

- **Onderzocht:** Spanje 8n 2a matchset 292; window 150 vs full; retry harness.
- **Belangrijkste resultaat:** retry full: C=29/292 (~9,9% ABC); attempt1 C=31, C→B recovery **0**; window-150 product path C=86 waarvan 78 `circuit_open`.
- **Beperkingen:** andere generation/timing dan 2026-09-06 runs; window-150 C-spike niet middelen met latere ~1% C-rates.

## C08 — C-density clustering (2026-09-06 12:50Z)

- **Onderzocht:** C-frequentie + clustering over 12 queries + 80×3 sample.
- **Belangrijkste resultaat:** unique C **0,94%**; stratified sample **4,58%**; price-sort max run **4**.
- **Beperkingen:** geen full-catalog 8288 live pricing; bucket 21–30 niet gemeten.

## C09 — Survival funnel (2026-09-06 17:38Z)

- **Onderzocht:** catalog 8288 → match → A/B/C → visible; C-cache reuse.
- **Belangrijkste resultaat:** unique C **0,82%**; visible ≈ match − A; C TTL 2 min; same-key immediate reprice = 0 HTTP.
- **Beperkingen:** niet middelen met C08 of C07.

## C10 — 300-offer latency/retry (2026-09-06 20:19Z)

- **Onderzocht:** LAST_B vs retry-2 op 300 offers @ 8/5/5.
- **Belangrijkste resultaat:** Last B = first-attempt complete = **39207 ms**; C=5; C→B **1/5**; product-style retry-2 klaar ~14685 ms (vóór Last B).
- **Beperkingen:** één run; niet generaliseren.

## C11 — 150-window 8,1 s / 33,9 s

- **Status:** **NIET TERUGGEVONDEN** als meetbestand.
- Later chat-tekst noemde “first 10 presentable ≈ 8,1 s / full window ≈ 33,9 s”.
- Geen bron gevonden die LAST_B vs retry-2 splitst. **Niet gebruiken als bewijs dat C/retry die 33,9 s veroorzaakte.**

## Important historical rule

This directory contains historical measurements.
Different runs may use different batches, providers, concurrency,
catalog generations or harnesses.

Measurements must not be silently combined.
