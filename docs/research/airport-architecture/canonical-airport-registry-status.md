# Canonical airport registry — implementatiestatus

**Datum:** 2026-08-31  
**Scope:** product domain + UI land→airport boom. **Geen** provider-mappings.

## Wat is live in code

| Item | Locatie |
|---|---|
| Registry | `lib/search/canonical-airports.ts` |
| Canonicalisatie / filter helpers | `lib/search/departure-airports.ts` |
| UI boom | `components/search/departure-airport-popup/*` |

## Identity

- Canonical identity = **IATA**
- URL blijft `?departureAirport=BRU,CRL` (OR)
- Offerfilter-semantiek ongewijzigd

## Landen + allowlist

| Land | IATA’s |
|---|---|
| België | BRU, CRL, ANR, OST, LGG |
| Nederland | AMS, EIN, RTM, GRQ, MST |
| Duitsland (expliciete grens-allowlist) | DUS, CGN, NRN |
| Frankrijk (expliciete grens-allowlist) | LIL |
| Luxemburg | LUX |

DE/FR zijn **geen** volledige nationale lijsten. Geen runtime afstandsberekening.

## Provider mappings

**Niet geïmplementeerd.** Volgende aparte fase: provider raw → canonical IATA.

Catalogus/`filter-options.json` bepaalt later welke offers per airport bestaan; de picker toont de product-registry.

## Provider mapping (fase 2 — geïmplementeerd)

Zie `provider-airport-mapping.md`.

**Provider mappings voor bewezen Corendon/Sunweb/Eliza inbound (+ Sunweb/Eliza outbound) zijn geïmplementeerd.**  
Vakanties.nl / De Jong / TravelDeal: **UNMAPPED** — aanvullende route vereist; providers blijven kandidaten.

### Onboardingregel (vast)

Elke nieuwe providerintegratie moet airport-complete zijn t.o.v.:

1. inbound representation  
2. canonical IATA mapping  
3. missing canonical airports  
4. outbound representation  
5. aliases  
6. filter compatibility  
7. live pricing airport requirements  
