# Sunweb/Eliza L0 baseline + L1 C=8 canary — historical C-relevant log

## Datum

- L0: 2026-08-30T21:38:27.598Z
- L1: 2026-08-30T21:51:03.248Z

## Doel

L0: baseline Sunweb/Eliza live-pricing @ productie-achtige C=5.  
L1: toetsen of Sunweb C=8 sneller **en** veiliger is dan C=5.

## Bron

- `docs/research/search-capacity/_sunweb_eliza_perf/l0-baseline.json`
- `docs/research/search-capacity/_sunweb_eliza_perf/l1-status.json`
- `docs/research/search-capacity/_sunweb_eliza_perf/l1-sunweb-c8.json`
- Samenvatting: `docs/research/search-capacity/sunweb-eliza-live-pricing-performance-research.md`
- Deployment-audit: `docs/research/search-capacity/performance-deployment-readiness-audit-2026-08-31.md`

## Scope

N=24 Sunweb (zelfde sample-set L0/L1). Eliza L0 ook N=24 in baseline JSON. Landing + grouped + GPP.

## Configuratie

- L0 Sunweb/Eliza page1 concurrency: **5**
- L1 Sunweb concurrency: **8** (canary)
- `CONTEXT_ITEM_ID_CACHE_TTL_MS`: **2000** (L0 knobs)
- Timeout: Niet als aparte L0-knob in JSON; latere forensics gebruiken 15 s AbortSignal.
- Retry count: Niet vastgesteld in beschikbare L0/L1 JSON.
- L2+: **niet** uitgevoerd op L1-bewijs.

## Methode

Research harness `scripts/_research_sunweb_eliza_perf/`. Echte provider HTTP.

## Resultaten

**L0 Sunweb concurrency C=5** (`l0-baseline.json`):

- wallMs: **10333**
- ok 16 / fail 8
- reasons: `network_error` **4**, `unavailable_trip` **4**
- http429: 0
- totalMs p50 432 / p95 10328 / max 10331

**L1 Sunweb C=8** (`l1-sunweb-c8.json` / `l1-status.json`):

- wallMs: **21699** (trager dan L0 10333; speedup 0.476)
- ok 8 / fail 16
- `network_error` **14**, `unavailable_trip` 2
- http429: 0
- totalMs p50 10586 / p95 10926 / max 10930

**Besluit L1:** canary C=8 **NIET** geaccepteerd. Default blijft C=5. Niet door naar L2.

## Conclusie

(Oorspronkelijk:) C=8 was niet aantoonbaar sneller en niet veiliger (`network_error`-spike).

## Beperkingen

- N=24.
- Intermittent: latere C=5 ladders reproduceerden de L0-spike niet altijd.
- Geen product A/B/C-tabel; `unavailable_trip` is A-klasse, `network_error` is C-klasse in latere semantiek.

## Historische betekenis

Eerste harde meting dat Sunweb technical failures (`network_error`) **stijgen met concurrency**. Onderbouwt waarom productie Sunweb op C=5 bleef.
