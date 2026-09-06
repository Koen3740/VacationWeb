# C-density & clustering — historical measurement

## Datum

2026-09-06T12:50:43.881Z

## Doel

Objectief meten hoe vaak product-C voorkomt en of C’s na sortering clusteren. Geen nieuwe presentatieregel.

## Bron

- `C:\Users\koenm\AppData\Local\Temp\vw-c-density\c-density-report.json`
- `C:\Users\koenm\AppData\Local\Temp\vw-c-density\c-density-summary.md`
- Generation pointer: `current.json` → `g20260905T184956Z-5c18c0dc21ed`

## Scope

- Catalog: **8288** (Corendon 4867 / Sunweb 2710 / Eliza 711)
- 12 representatieve filter-queries (o.a. Spanje/Griekenland/Turkije/Portugal/Cyprus/Italië/Egypte + car/pool/beach)
- Plus gestratificeerde sample 80+80+80 = **240** (apart gerapporteerd)
- Full catalog 8288 live pricing: **niet gemeten**

## Configuratie

- Page size: 10
- Timeouts: 15000 ms (product path)
- Retry: product `priceLiveRequiredMatchset` op queries; sample gebruikt explicit retry harness
- Concurrency: Niet als aparte assert in de summary vastgelegd; product path gebruikt productieconstanten.
- Cache TTL: Niet het primaire onderwerp van deze run.

## Methode

Product live-pricing per query → A/B/C via `isProviderConfirmedUnavailable` / `hasValidPresentablePrice` / ERROR-unavailable = C. Ranking: price-sorts B first, non-presentable (incl. C) appended; A dropped voor pagination. Clustering: consecutive runs, page histograms, sliding windows 5/10/20.

## Resultaten

**Query-populatie (niet middelen met sample):**

| | A | B | C | PENDING |
|--|--:|--:|--:|--------:|
| Offer-attempts | 105 | 926 | 13 | 0 |
| Unique (n=849) | 88 | 753 | 8 | 0 |

- Unique C / unique ABC: **0.94%** (~9.4 / 1000)
- Attempt C / attempt ABC: **1.25%**
- Unique C reasons: `stale_context` 5, `http_error` 2, `missing_context` 1
- Provider attempts: Corendon B474/A88/C9 · Sunweb B371/A14/C2 · Eliza B81/A3/C2
- HTTP alle query-fasen: 3089 · wall ~101 s

**Gestratificeerde sample (apart):**

- n=240, B=229, C=11, A=0 → C-rate **4.58%**
- Eliza 7/80 C; Sunweb 3/80; Corendon 1/80
- C reasons: `stale_context` 8, `http_error` 2, `missing_context` 1
- Retry: attempt1C=12, retried=11, attempt2B=1, still C=10, recovery ~8%

**Clustering (12 queries, listable na drop A):**

| Sort | max consecutive C | max C/page (agg.) |
|------|------------------:|------------------:|
| value | 1 | 2 |
| price / price-desc / price-per-day | 4 | 4 |
| rating / stars / departure | 2 | 2 |

Worst price cluster die run: Spanje-8n C op posities 267–270 (trailing block).

**Small resultsets:** 1–20 gemeten queries hadden 0 C. Bucket 21–30: **niet gemeten**.

## Conclusie

(Oorspronkelijk:) C was ongewoon in de query-set (~1%) maar price-sorts parkeren C achter alle B. Sample Eliza C-zwaarder. Geen “max 1 C per pagina” afgeleid.

## Beperkingen

- Geen 8288-census.
- 0.94% en 4.58% zijn **verschillende populaties**.
- Warmte/load verschilt van C07 (Spain 292, hogere C + circuit_open).

## Historische betekenis

Eerste clustering-bewijs dat price-sort C-blokken **structureel** zijn (`rankLivePricedCandidatePool`), niet toevallige adjacency.
