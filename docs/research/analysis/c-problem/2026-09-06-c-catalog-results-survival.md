# Catalog → Results survival + C cache — historical measurement

## Datum

2026-09-06T17:38:48.123Z

## Doel

Funnel: catalog → filter matchset → A/B/C → visible. Plus C-cache/hergebruik bij occupancy-key.

## Bron

- `C:\Users\koenm\AppData\Local\Temp\vw-survival-audit\survival-report.json`
- `C:\Users\koenm\AppData\Local\Temp\vw-survival-audit\survival-summary.md`
- Code (cache, niet herberekend): `lib/search/results-live-price-cache.ts`

## Scope

Generation `g20260905T184956Z-5c18c0dc21ed`, catalog **8288**. 11 queries. Geen 80×3 sample (survival-focus).

C08 (ochtend density) is in het rapport als **HISTORICAL** gelabeld en niet gemiddeld.

## Configuratie

- Timeouts: 15000 / 15000 / 15000
- Retry max attempts (product): **2**
- Page size: 10
- C overlay TTL (code): `RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS` = **2 min**
- B/A overlay TTL (code): `RESULTS_LIVE_PRICE_TTL_MS` = **8 h**
- Cache key: occupancy (`adults|children|babies|rooms|offerId` + party + optional listingKey) — **niet** land/dates/nights/sort

## Methode

`filterOffers` → `priceLiveRequiredMatchset` → classify. Visible = listable = not A. Cache probe op één C-offer (`corendon-14035-RTMBCN-220926-7-DZWA`).

## Resultaten

**Unique priced:** n=849 → B 754 / A 88 / C 7 → unique C-rate **0.82%**. Attempts C **1.09%** (11/1005).

Unique C reasons: `stale_context` 4, `http_error` 2, `network_error` 1, `missing_context` 1.  
Unique A reasons: `http_204` 65, `unavailable_trip` 14, `invalid_price` 9.

Survivaltabel (catalog altijd 8288):

| query | matchN | A | B | C | visible | C% match |
|-------|-------:|--:|--:|--:|--------:|---------:|
| spanje-8n | 276 | 6 | 266 | 4 | 270 | 1.45% |
| griekenland-8n | 395 | 67 | 327 | 1 | 328 | 0.25% |
| turkije-8n | 80 | 1 | 76 | 3 | 79 | 3.75% |
| portugal-8n | 23 | 5 | 18 | 0 | 18 | 0% |
| egypte-8n | 56 | 7 | 49 | 0 | 49 | 0% |
| cyprus-8n | 11 | 0 | 11 | 0 | 11 | 0% |
| italie-8n | 8 | 1 | 7 | 0 | 7 | 0% |
| griekenland-8n-car | 95 | 16 | 79 | 0 | 79 | 0% |
| turkije-8n-car | 2 | 0 | 2 | 0 | 2 | 0% |
| spanje-8n-pool | 45 | 2 | 40 | 3 | 43 | 6.67% |
| spanje-8n-beach | 14 | 1 | 13 | 0 | 13 | 0% |

A verwijderd vóór pagination: visible = match − A in deze run.

**Cache probe:**

| Call | occupancy | HTTP | abc |
|------|-----------|-----:|-----|
| 1 | 2A/1R | 6 | C `stale_context` |
| 2 immediate same | 2A/1R | **0** | C (cache hit) |
| 3 adults=3 | 3A/1R | 0 | unpriced (occupancy_unsupported) |
| 4 rooms=2 | 2A/2R | 4 | C `stale_context` (nieuwe key) |

Clustering (deze run): value max run 1, max C page1 **0**; price max run 4, max C/page 4, max C page1 **0**.

## Conclusie

(Oorspronkelijk:) grootste dropout is filter vóór live. C blijft zichtbaar. In-process C-cache voorkomt same-key HTTP binnen TTL; nieuwe isolate/reload/TTL-expiry niet bewezen als durable.

## Beperkingen

- Geen 24h productie-log census.
- Cross-request serverless cache: niet als gegarandeerde hit bewezen.
- Niet middelen met C07 of C08.

## Historische betekenis

Maakt C-hergebruik meetbaar (0 HTTP op immediate repeat) en scheidt filter-dropout van A-dropout van C-zichtbaarheid.
