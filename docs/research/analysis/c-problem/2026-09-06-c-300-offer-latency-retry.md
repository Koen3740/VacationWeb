# 300-offer live-pricing latency + retry-2 — historical measurement

## Datum

Capture: **2026-09-06T20:19:23Z**

## Doel

Meten hoe lang een realistische batch van ~300 live prices duurt, wanneer de **laatste B** binnen is, en welke extra tijd/waarde **retry 2** in **deze run** opleverde.

Dit is één historische run. Niet generaliseren.

## Bron

- `C:\Users\koenm\AppData\Local\Temp\vw-latency-retry\latency-retry-report.json`
- `C:\Users\koenm\AppData\Local\Temp\vw-latency-retry\latency-retry-summary.md`

## Scope

Generation: **g20260905T184956Z-5c18c0dc21ed** (8288, match=true).

Samenstelling: Spanje 276 + Griekenland 12 + Turkije 12 = **300**.  
Provider: Corendon **77** / Sunweb **196** / Eliza **27**.

Occupancy: departure 2026-09-06..2026-09-30, nights=8, adults=2, rooms=1.

## Configuratie

- Corendon concurrency: **8** (asserted)
- Sunweb concurrency: **5** (asserted)
- Eliza concurrency: **5** (asserted)
- Timeouts: 15000 ms (alle drie)
- Retry: max 2, alleen retryable technical C
- `CONTEXT_ITEM_ID_CACHE_TTL_MS`: 10000

## Methode

- Phase A: attempt 1 only, per-provider pools 8/5/5, timestamps t0-relatief.
- Phase B: retry 2 alleen op attempt-1 C; sequential na A + product-style overlap-simulatie (retry start = attempt1_end + gemeten retry2 duration).
- Phase C: `filterOffers` tijdens in-flight pricing; `prepareResultsOffers` value vs price.
- Extra: `priceLiveRequiredMatchset` op 300 ná eerdere fases (warm transport mogelijk).

## Resultaten

### Latency (attempt 1)

| Milestone | ms |
|-----------|---:|
| First B | 718 |
| 10 B | 1911 |
| 25% B | 7868 |
| 50% B | 13485 |
| 75% B | 24158 |
| 90% B | 35514 |
| 95% B | 37077 |
| Last B | **39207** |
| First-attempt complete | **39207** |
| First-attempt complete − Last B | **0** |

Attempt-1 A/B/C: **7 / 288 / 5**. Eventual B count: 288.

### C (deze batch)

- 5/300 = **1.67%** = 16.7 per 1000
- Reasons: Corendon `stale_context` ×4; Eliza `network_error` ×1
- Attempt-1 C durations: 198, 221, 267, 203, **10623** ms

### Retry 2

| | |
|--|--:|
| C retried | 5 |
| C → B | 1 (`eliza-37981`, network_error → B, 3735 ms) |
| C → A | 0 |
| C → C | 4 (alle Corendon stale_context, ~83–84 ms) |
| Recovery | **20%** |
| Median / p95 / max | 84 / 3735 / 3735 ms |
| Product-style retry-2 complete | **14685 ms** |
| Foreground complete (product-style) | **39207 ms** |
| Sequential A+B wall | 42944 ms |

In **deze** run: retry 2 finished before Last B (14685 ≪ 39207). Foreground − Last B = **0 ms**.

### Filter/sort (deze run)

- `filterOffers` beach/acco tijdens pricing: **12 / 13 ms** — geen wait op live/retry
- `prepareResultsOffers` sort=value return: **337 ms**
- sort=price provisional return: **553 ms**
- `exactOffers` price: **14264 ms** (await live window, inclusief product retry)
- `FOREGROUND_PRODUCT_MS` later: **17895** — rapport noteert warm TCP/context t.o.v. cold phase A 39207

## Conclusie

(Oorspronkelijk, alleen deze run:) overlapping retry-2 verlengde het kritieke pad niet voorbij Last B. Recovery was 1/5, niet 0. Filters wachtten niet op pricing. Price-sort `exactOffers` wacht wél op het live window.

Geen productbeslissing “haal retry 2 weg” of “houd retry 2” afgeleid als universele regel.

## Beperkingen

- Eén run.
- Phase A was attempt-1-only; product overlap is deels gesimuleerd met gemeten retry-durations.
- `FOREGROUND_PRODUCT_MS` is geen cold start.
- Split LAST_B vs retry-2 ontbrak in oudere “33,9 s window”-citaten (C11 niet gevonden).

## Historische betekenis

Eerste beschikbare meting die **Last B** en **retry-2 completion** uit elkaar haalt op ~300 offers @ productie 8/5/5.
