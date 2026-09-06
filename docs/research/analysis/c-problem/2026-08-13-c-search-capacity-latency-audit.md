# Search-capacity & latency audit (price-only) — historical C-relevant log

## Datum

2026-08-13 (audit runs). Document-closeout note 2026-08-21.

## Doel

Meten hoeveel kandidaten (N) in één zoekopdracht live **price-only** verrijkt kunnen worden, bij concurrency 1 / 5 / 10 / **20**, binnen een analysegrens van ~10 s.

## Bron

- `docs/research/search-capacity/search-capacity-latency-audit.md`
- Index: `docs/research/search-capacity/README.md`

## Scope

Providers: Prijsvrij Search (clustered + deels diverse), Corendon `lowestpricesacco`, Sunweb/Eliza GetPromotedPrice (zonder landing in de price-API matrix). Samples tot N=300 per provider.

## Configuratie

- N: 50, 100, 150, 200, 250, 300
- Concurrency: 1, 5, 10, **20**
- **C=20 = historische benchmarkconfiguratie, niet de latere Results-productie (Corendon 8 / Sunweb 5 / Eliza 5).**
- Prijsvrij Receipt: **niet** getest in deze matrix
- Timeout / retry / cache TTL: Niet vastgesteld in beschikbare bron als één product-TTL voor A/B/C.

## Methode

Research harness `scripts/_sub18_search_capacity/` (≥3 runs per cel waar gerapporteerd). Geen productiecode gewijzigd in het auditdocument.

## Resultaten

Uit het oorspronkelijke auditdocument (niet herberekend):

- Clustered Prijsvrij Search: N=100–300 mediaan ~0,7–2,3 s @ c=10 via ≤12 atomic contexts.
- Corendon: bij c≥5 tot N=300 binnen ~10 s mediaan mogelijk.
- Sunweb price-API: bij c=5 N=150 mediaan ~8,6 s (zonder landing) in later geciteerde Sub-18 vergelijking (`b4-followup-provider-performance-comparison.md`).
- Diverse Prijsvrij N=150–300: **niet getest** (te lang bij N=100 c=1).

## Conclusie

(Oorspronkelijk:) clustered Search kan groot N snel; dat is **niet** Receipt. C=20 hoorde bij deze capacity-matrix, niet bij later Results live-pricing 8/5/5.

## Beperkingen

- Geen VacationWeb A/B/C-classificatie.
- Sunweb/Eliza landing-HTML zat niet in de price-API matrix.
- Geen C-density, geen retry-2 vs LAST_B.

## Historische betekenis

Toont dat “C=20” in oudere chats een **harness-concurrency** was. Mag niet worden verward met huidige product-concurrency of met product-C (technical failure).
