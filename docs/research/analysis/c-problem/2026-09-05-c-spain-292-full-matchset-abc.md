# Spain 292 full-matchset A/B/C + retry — historical measurement

## Datum

2026-09-05T15:07:56.369Z

## Doel

Meten van A/B/C op een Spanje-matchset (292), zowel product-path (window 150 vs full) als explicit retry-harness (max 2 attempts).

## Bron

- `.test-out/forensics-full-matchset-abc-report.json`
- Harness: `.test-out/forensics-full-matchset-abc.ts`

## Scope

Query: Spanje, departure 2026-09-06..2026-09-26, nights=8, adults=2, rooms=1, sort=value.

Raw matchset: **292** (Corendon 105 / Sunweb 156 / Eliza 31).

## Configuratie

- `CORENDON_LIVE_MATCHSET_CONCURRENCY` = 8
- `SUNWEB_LIVE_MATCHSET_CONCURRENCY` = 5
- `ELIZA_LIVE_PAGE1_CONCURRENCY` = 5
- Timeouts: 15000 ms (alle drie)
- `CONTEXT_ITEM_ID_CACHE_TTL_MS` = 10000
- `RESULTS_LIVE_PRICING_CANDIDATE_CAP` = 150

## Methode

1. Product `priceLiveRequiredMatchset` op live-window 150
2. Product path op full matchset 292
3. Retry harness: attempt 1 → bij retryable C attempt 2
4. Zelfde harness op window 150

## Resultaten

**Product window 150** (wall 10569 ms, 177 HTTP):

| | B | A | C |
|--|--:|--:|--:|
| Totaal | 26 | 38 | 86 |
| Corendon | 7 | 12 | 86 |
| Sunweb | 19 | 26 | 0 |

C-reasons window: `stale_context` 8, `circuit_open` **78**. Listable 112.

**Product full 292** (wall 28185 ms, 630 HTTP):

| | B | A | C |
|--|--:|--:|--:|
| Totaal | 115 | 149 | 28 |
| Corendon | 48 | 40 | 17 |
| Sunweb | 49 | 107 | 0 |
| Eliza | 18 | 2 | 11 |

C-reasons full product: `stale_context` 28.

**Retry harness full 292** (wall 44859 ms):

- Final A/B/C: 148 / 115 / **29**
- C-rate among attempted ABC: **0.0993** (~9,9%)
- C-reasons: `stale_context` 28, `timeout` 1
- Retry: attempt1C=31, retried=31, attempt2B=**0**, attempt2A=2, attempt2C=29, recoveryToBRate=**0**
- Duration p50 318 / p95 1663 / max 15307 ms

**Retry window 150:** B 67 / A 66 / C 17; all C `stale_context`; retry 17→17 C, 0 recovery.

## Conclusie

(Oorspronkelijk, deze run:) technical C kwam voor; in de 150-window product path domineerde `circuit_open`. Retry-2 leverde **0** C→B op deze 292-set.

## Beperkingen

- Catalog/timing ≠ `g20260905T184956Z-5c18c0dc21ed` 2026-09-06 runs (C08–C10). **Niet middelen.**
- Window-150 C=86 is een andere populatie dan full-292 C=28/29.
- Geen LAST_B vs retry-2 split.
- `circuit_open` in window-150 ontbreekt in de latere 2026-09-06 density-run.

## Historische betekenis

Toont dat C-rate **conditie-afhankelijk** is (circuit open vs later ~1%). Ook: retry-2 recovery kan 0% zijn op één dag en 20% op een andere (C10) — aparte experimenten.
