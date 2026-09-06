# Eliza transport / keep-alive vs stale_context — historical C-relevant log

## Datum

2026-08-31

## Doel

Onderscheiden Eliza **transport**-fouten (`network_error` / connect timeout) van **application** `stale_context`.

## Bron

- `docs/research/search-capacity/_sunweb_eliza_perf/eliza-transport-keepalive-analysis.md`
- Raw: `eliza-transport-keepalive-raw.json`
- Harness: `scripts/_eliza_transport_keepalive_forensics.ts`

## Scope

Eliza was here live pricing. C=5 ongewijzigd. C=8 niet gebruikt.

## Configuratie

- AbortSignal: **15000 ms** (ongewijzigd)
- `ELIZA_LIVE_PAGE1_CONCURRENCY` = **5**
- Canary keep-alive: default OFF (`VACATIONWEB_ELIZA_KEEPALIVE=1`)
- Agent maxSockets default 32 (research/canary)

## Methode

Research harness + step telemetry (`transportErrorCode`). Geen deploy in het analyserapport.

## Resultaten

Uit de oorspronkelijke analyse:

- L0 cold serial: **1×** `network_error`, max totalMs ~10693 (~10 s connect-klasse), 0×429
- L0 C=5: **0×** `network_error` (wel stale_context/empty); intermittent
- `stale_context` = application/data, geen transport
- Connect-failures tijdelijk / concurrency-gevoelig, geen structureel defecte URL
- Intermittentie: L0 C=5 had 0 NE; A/B C=5 had 7 — load/path dependent

## Conclusie

(Oorspronkelijk:) transport-fout ≠ `stale_context`. Keep-alive was optionele canary, geen bewezen productfix in dit document.

## Beperkingen

- Canary-status in het document is historisch (implementatie-notitie); dit logbestand wijzigt die status niet.
- Geen A/B/C-percentages over een Results-matchset.

## Historische betekenis

Voorkomt dat alle Eliza-C’s als één probleem worden behandeld. `stale_context` (vaak C in later Results) is een andere klasse dan connect `network_error`.
