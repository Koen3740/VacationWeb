# Provider → canonical airport mapping

**Datum:** 2026-08-31  
**Type:** research + implemented mapping layer  
**Canonical registry:** `lib/search/canonical-airports.ts`  
**Mapping module:** `lib/search/provider-airport-mapping.ts`  
**Feed sample script:** `scripts/_sample_provider_airports.ts`  

**Provider mappings for Vakanties.nl / De Jong / TravelDeal:** not inventively filled — status UNMAPPED with follow-up required.

---

## Onboardingregel (vast — elke nieuwe provider)

ELKE NIEUWE PROVIDER MOET BIJ INTEGRATIE WORDEN GECONTROLEERD OP:

1. **inbound** airport representation (feed / URL / API)
2. **canonical IATA** mapping naar `CANONICAL_AIRPORTS`
3. **ontbrekende canonical airports** (`CANONICAL_AIRPORT_MISSING` → productbeslissing)
4. **outbound** airport representation voor live pricing/availability
5. provider-specifieke **aliases** / place names / route-fragmenten
6. **airport-filter** compatibility (`?departureAirport=` OR-semantiek)
7. live pricing/availability airport requirements

Een providerintegratie is pas **airport-complete** wanneer deze controle is uitgevoerd en gedocumenteerd.

---

## Statussamenvatting

| Provider | Inbound | Outbound | Airport-complete? |
|---|---|---|---|
| Corendon | MAPPED (IATA + airportRoute) | NOT_APPLICABLE (needs airportRoute) | **JA** (catalog/filter); live uses fragment |
| Sunweb | MAPPED (IATA / XX-IATA / proven names) | MAPPED (`DepartureAirport[0]=IATA`) | **JA** |
| Eliza was here | MAPPED (URL IATA / property IATA) | MAPPED (`DepartureAirport[0]=IATA`) | **JA** |
| Vakanties.nl | UNMAPPED | UNMAPPED | **NEE** — aanvullende route vereist |
| De Jong Intra | UNMAPPED | UNMAPPED | **NEE** — aanvullende route vereist |
| TravelDeal | UNMAPPED | UNMAPPED | **NEE** — aanvullende route vereist |

Conclusie voor UNMAPPED providers: **airport mapping momenteel niet mogelijk met beschikbare providerdata / aanvullende route vereist.** Provider blijft integratiekandidaat — niet “ongeschikt”.

---

## Cross-provider matrix

| Provider | Bron | Raw forms (bewezen) | → Canonical | Outbound | Status |
|---|---|---|---|---|---|
| Corendon | feed `iataDeparture` | AMS,BRU,CGN,CRL,DUS,EIN,GRQ,MST,NRN,RTM | zelfde IATA | n.v.t. IATA-only | MAPPED |
| Corendon | feed `isoCodeDeparture` | BE, NL, DE | — | — | NOT_APPLICABLE |
| Corendon | fragment `airportRoute` | e.g. BRUCFU, EINPMI | first3 → IATA | live uses full route | MAPPED inbound |
| Sunweb | feed `IsoCodeDeparture` | AMS,BRU,CGN,CRL,DUS,EIN,LIL,LUX,NRN,RTM | IATA | `DepartureAirport[0]` | MAPPED |
| Sunweb | feed `airport` | place names (see below) | IATA | — | MAPPED |
| Sunweb | URL / merge | `DepartureAirport[0]`, `none` | IATA / N/A | IATA | MAPPED / NOT_APPLICABLE |
| Eliza | URL `DepartureAirport[0]` | IATA | IATA | IATA | MAPPED |
| Eliza | property `airport` | AMS,BRU,CGN,CRL,DUS,EIN,LIL,LUX,NRN,RTM | IATA | — | MAPPED |
| Vakanties.nl | TT algemeen | geen airport props | — | — | UNMAPPED |
| De Jong | TT Algemeen | geen airport props | — | — | UNMAPPED |
| TravelDeal | TT Datafeed/Algemeen | geen airport props | — | — | UNMAPPED |

---

## Inbound mappings (geïmplementeerd)

### Corendon
| Raw | Canonical | Evidence |
|---|---|---|
| `BRU` … (feed iataDeparture set) | zelfde | Productfeeds Corendon BENL/NL sample |
| `BRUCFU` (airportRoute) | `BRU` | code `mapCorendonAirportRouteInbound` + listing tests |
| `BE` / `NL` / `DE` | — | NOT_APPLICABLE |

### Sunweb
| Raw | Canonical | Evidence |
|---|---|---|
| IATA in IsoCodeDeparture / URL | zelfde | feed sample + IBE bijbel |
| `BE-BRU` etc. | IATA | registry aliases + XX-IATA |
| Amsterdam | AMS | feed `airport` |
| Brussel Zaventem | BRU | feed |
| Brussel Charleroi | CRL | feed |
| Düsseldorf | DUS | feed |
| Eindhoven | EIN | feed |
| Köln/Bonn | CGN | feed |
| Lille | LIL | feed |
| Luxemburg | LUX | feed |
| Rotterdam | RTM | feed |
| Weeze | NRN | feed |
| `none` | — | NOT_APPLICABLE |

### Eliza
| Raw | Canonical | Evidence |
|---|---|---|
| URL `DepartureAirport[0]` | IATA | importer URL-first |
| property `airport` IATA | IATA | feed sample |

---

## Outbound mappings (geïmplementeerd)

| Provider | VW IATA | Outbound value | Status |
|---|---|---|---|
| Sunweb | e.g. BRU | `BRU` (`DepartureAirport[0]`) | MAPPED |
| Eliza | e.g. BRU | `BRU` (`DepartureAirport[0]`) | MAPPED |
| Corendon | e.g. BRU | — | NOT_APPLICABLE (need `airportRoute`) |
| Vakanties.nl / De Jong / TravelDeal | any | — | UNMAPPED |

---

## Unmapped / unknown

| Case | Status |
|---|---|
| Empty raw | UNMAPPED |
| Unknown free text | UNKNOWN (niet stilzwijgend herleid) |
| `none` / sentinels | NOT_APPLICABLE |
| Country ISO | NOT_APPLICABLE |
| Vakanties.nl / De Jong / TravelDeal structured airport | UNMAPPED |

---

## Ontbrekende canonical airports

Feed samples voor Corendon/Sunweb/Eliza leverden **geen** IATA buiten de huidige registry.

Registry bevat ANR/OST/LGG die **niet** in de Corendon BENL/NL `iataDeparture`-sample voorkwamen — dat is picker-inventaris ≠ feed-dekking, geen `CANONICAL_AIRPORT_MISSING`.

Als later een provider-IATA buiten de registry verschijnt → status `CANONICAL_AIRPORT_MISSING` → **geen** auto-extend; productbeslissing.

---

## Implementatie

| File | Rol |
|---|---|
| `lib/search/provider-airport-mapping.ts` | inbound/outbound API + declared rows |
| `lib/search/departure-airports.ts` | `canonicalizeDepartureAirportCode` gebruikt inbound resolver |
| `lib/providers/corendon/listing-selection.ts` | `departureIataFromAirportRoute` via mapping |

Filtersemantiek / URL `?departureAirport=` / OR: **ongewijzigd**.

---

## Tests

- `lib/search/provider-airport-mapping.test.ts`
- bestaande `departure-airports` / hero-flow / provider tests
