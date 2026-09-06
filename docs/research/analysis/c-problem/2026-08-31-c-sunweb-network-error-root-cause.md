# Sunweb `network_error` root-cause — historical C-relevant log

## Datum

2026-08-31

## Doel

Vaststellen wat productie-classificatie `network_error` op Sunweb live-price technisch is (timeout vs connect vs 429 vs parse).

## Bron

- `docs/research/search-capacity/_sunweb_eliza_perf/sunweb-network-error-root-cause-report.md`
- Raw: `sunweb-network-error-forensics-raw.json`
- Harness: `scripts/_sunweb_network_error_forensics.ts`

## Scope

N=24, zelfde sample-set als L0/L1. Native fetch (productie-achtig) + diagnostische keep-alive stand-in.

## Configuratie

- `SUNWEB_LIVE_TIMEOUT_MS` = **15000** (AbortSignal)
- Concurrency ladder: 1 / 3 / 5
- Geen productie keep-alive; geen C=8 canary in deze forensics
- Retry: één serial re-run van een gefaalde offer

## Methode

Geïnstrumenteerde `fetchImpl` die exception `cause` vastlegt. Productie-catch ongewijzigd (details discarded).

## Resultaten

Native fetch (die run):

| C | wall ms | ok | network_error | timeout | 429 | unavailable_trip |
|--:|--------:|---:|--------------:|--------:|----:|-----------------:|
| 1 | 21228 | 17 | 1 | 0 | 0 | 6 |
| 3 | 3931 | 18 | 0 | 0 | 0 | 6 |
| 5 | 2762 | 18 | 0 | 0 | 0 | 6 |

Gevangen exceptie (C=1, `sunweb-6128017-…`):

- `TypeError: fetch failed` ← `ConnectTimeoutError` / `UND_ERR_CONNECT_TIMEOUT`
- timeout: **10000 ms** (undici default)
- hop: landing connect
- durationMs ~11072
- grouped/GPP niet gestart

Serial retry van dezelfde offer: **beide OK**.

Historische L0/L1 (niet herberekend): C=5 4× NE wall ~10333; C=8 14× NE wall ~21699; failures ~10–11 s, niet 15 s.

## Conclusie

(Oorspronkelijk:) `network_error` is **niet** de 15 s AbortSignal; het is landing **connect timeout**. Transient, load-sensitive. 0×429.

## Beperkingen

- Deze C=5 run reproduceerde de L0-spike niet.
- Keep-alive tabel is diagnostische stand-in, geen productieclaim.
- Productie logt geen `UND_ERR_CONNECT_TIMEOUT`.

## Historische betekenis

Koppelt product-C reason `network_error` aan transport, niet aan “trip unavailable” (A). Verklaart waarom retry soms B kan worden (C10: Eliza `network_error` → B; Sunweb-serial retry OK).
