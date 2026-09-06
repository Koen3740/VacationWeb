# B4 circuit_open observability — historical C-relevant log

## Datum

2026-08-30

## Doel

Documenteren van de B4-implementatie die technische live-price failures kan afkappen via een circuit breaker, en `circuit_open` als observability-reason (ERROR / product-C klasse) vastlegt.

## Bron

- `docs/research/search-capacity/b4-completion-report.md`
- `docs/research/search-capacity/catalog-live-pricing-phases-a-b-status.md`
- `docs/research/search-capacity/b4-waituntil-cache-gates.md`

## Scope

Productiecode-paden `run*LiveIntoCache` (Prijsvrij/Corendon/Sunweb/Eliza). Geen nieuwe live provider-run in de B4-acceptatie voor foutpercentage bij C=8.

## Configuratie

- Corendon matchset/page1 concurrency: **8**
- Sunweb / Eliza / Prijsvrij-pad: **5**
- Circuit: threshold **5** technical failures, open **30 s**
- `circuit_open`: short technical TTL; niet retryable
- Keep-alive bench: **local HTTP stand-in** (live `api-fe` gaf ECONNRESET)

## Methode

Implementatie + unit tests (`live-price-observability.test.ts` circuit_open; `b4-orchestration-evidence.test.ts`). Keep-alive throughput op lokale server.

## Resultaten

- `circuit_open` geclassificeerd als ERROR-reason.
- Circuit schrijft unavailable zonder feed-€ als live.
- KA stand-in: 1,73× offers/s vs agent=false (n=20).
- Instance-hit % process-local cache: **ONBEKEND**.

## Conclusie

(Oorspronkelijk:) B4 AFGEROND. Circuit begrenst cascading technical failures. Shared cache uitgesteld.

## Beperkingen

- Geen live Corendon foutpercentage @ C=8 in die fase.
- `circuit_open` volume in productie niet in dit rapport gemeten.
- Later (2026-09-05 Spain window-150) toonde 78× `circuit_open` in een andere run — dat is een **apart** experiment (C07).

## Historische betekenis

Definieert `circuit_open` als C-reason (technisch, short TTL, geen 8h A-blacklist). Relevant wanneer later C-density `circuit_open` telt.
