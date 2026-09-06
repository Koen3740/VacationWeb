# Prijsvrij Receipt capacity/concurrency — historical C-relevant log

## Datum

Circa 2026-08-14 (runs-v2 in het concurrency-audit). Consolidation 2026-08-21.

## Doel

Meten of Prijsvrij **Receipt** (eind-pp) paralleliseerbaar is voor Search-page volumes, en wat C=5 vs C=10 vs **C=20** doet met wall-clock, usable % en timeouts.

## Bron

- `docs/research/search-capacity/prijsvrij-receipt-capacity-concurrency-audit.md`
- `docs/research/search-capacity/prijsvrij-receipt-capacity-final-consolidation.md`

## Scope

Prijsvrij Receipt only. N=25 probe + N=50…300 @ C=10 (en C=5 voor N=50/100).

## Configuratie

- Client timeout-band in audit: ~25 s
- C=2 / 5 / 10 / **20** (C=30/50 niet uitgevoerd)
- **C=20 = historische Receipt-benchmark, niet huidige Results-productieconcurrency.**

## Methode

Research harnesses onder `scripts/_sub17_prijsvrij_receipt_capacity/`. Mediaan over runs in `runs-v2`.

## Resultaten

N=25 probe (oorspronkelijke tabel):

| C | Median wall | Median usable | Timeouts (med) |
|--:|------------:|--------------:|---------------:|
| 2 | ~89 s | 92% | 0 |
| 5 | ~41 s | 92% | 0 |
| 10 | ~25 s | 88% | 1 |
| 20 | ~25 s | 84% (volatile; één run 64%) | 2 |

N=50…300 @ C=10 (median wall): 51.4 s / 88.0 s / 104.8 s / 119.9 s / 142.8 s / 166.2 s. Geen cel ≤10 s. 0×429. Usable ~69–79%.

Background consolidation (apart document): first-10 ~23–41 s voor N=50…300; **all** schaalt met N (tot ~499 s @ N=300).

## Conclusie

(Oorspronkelijk:) C=5 stabielst; C=20 onbetrouwbaarder. Receipt is niet snel genoeg voor interactieve Search-list van N=50–300.

## Beperkingen

- Ander pad dan Corendon/Sunweb/Eliza Results live pricing.
- Prijsvrij later PARKED voor interactieve Results.
- Geen product-C vs A split.

## Historische betekenis

Voorkomt dat “C=20 traag/onstabiel” wordt gelezen als bewijs over **huidige** Results C=8/5/5 of over product-C (technical failure).
