# US-09 Verification Report

Status: Geïmplementeerd en geverifieerd  
Datum: 2026-06-24  
Scope: Zoekindex voor geïmporteerde offers.

## 1. Doel van de zoekindex

US-09 implementeert een minimale zoekindex voor offers zodat opgeslagen vakanties snel kunnen worden gevonden op basis van kernvelden zoals:

- hotelnaam
- bestemming
- land
- regio
- aanbieder

Doel is om de eerste zoekervaring over de geïmporteerde offers mogelijk te maken zonder een externe zoekengine te vereisen.

---

## 2. Gekozen technologie

De eerste versie gebruikt een eenvoudige interne JSON-gebaseerde zoekindex:

- geen externe database- of zoekservice nodig
- snel te implementeren
- volledig compatibel met de huidige file-backed ingestflow
- voldoende voor Phase 1 proof of concept

---

## 3. Betrokken bestanden

- [lib/search/index.js](../lib/search/index.js)
- [lib/search/index.test.js](../lib/search/index.test.js)
- [data/phase1a-proof/offers.json](../data/phase1a-proof/offers.json)
- [data/phase1a-proof/offers-index.json](../data/phase1a-proof/offers-index.json)

---

## 4. Implementatie

De zoekindex bouwt een documentlijst van offers met de kernvelden voor zoeken en ondersteunt:

- bouwen van een index vanuit offers
- toevoegen van nieuwe offers aan de index
- zoeken op basis van een querystring over relevante tekstvelden

### Voorbeeld indexstructuur

```json
{
  "documents": [
    {
      "id": "cor-1001",
      "externalId": "cor-1001",
      "hotelName": "Hotel Palma Bay",
      "destination": "Mallorca",
      "country": "Spain",
      "region": "Balearic Islands",
      "price": 689,
      "currency": "EUR",
      "nights": 7,
      "boardType": "All Inclusive",
      "departureDate": "2026-07-10",
      "provider": "Corendon"
    }
  ],
  "createdAt": "2026-06-24T21:09:21.175Z"
}
```

---

## 5. Tests

### Uitgevoerde test

```bash
node --test lib/search/index.test.js
```

### Testresultaat

```text
✔ US-09 indexes imported offers and supports destination and hotel searches (19.796ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

---

## 6. Voorbeeld zoekopdrachten

### Zoekopdracht: Mallorca

```json
{
  "query": "Mallorca"
}
```

### Resultaat

```json
[
  {
    "externalId": "cor-1001",
    "hotelName": "Hotel Palma Bay",
    "destination": "Mallorca",
    "country": "Spain",
    "region": "Balearic Islands",
    "price": 689,
    "currency": "EUR",
    "nights": 7,
    "boardType": "All Inclusive",
    "departureDate": "2026-07-10",
    "provider": "Corendon"
  }
]
```

### Zoekopdracht: Palma

```json
{
  "query": "Palma"
}
```

### Resultaat

```json
[
  {
    "externalId": "cor-1001",
    "hotelName": "Hotel Palma Bay",
    "destination": "Mallorca",
    "country": "Spain",
    "region": "Balearic Islands",
    "price": 689,
    "currency": "EUR",
    "nights": 7,
    "boardType": "All Inclusive",
    "departureDate": "2026-07-10",
    "provider": "Corendon"
  }
]
```

### Zoekopdracht: Tenerife

```json
{
  "query": "Tenerife"
}
```

### Resultaat

```json
[
  {
    "externalId": "cor-1002",
    "hotelName": "Hotel Playa Azul",
    "destination": "Tenerife",
    "country": "Spain",
    "region": "Canary Islands",
    "price": 799,
    "currency": "EUR",
    "nights": 8,
    "boardType": "Half Board",
    "departureDate": "2026-07-18",
    "provider": "Corendon"
  }
]
```

---

## 7. Bewijs dat de zoekindex werkt op geïmporteerde offers

De proof-run heeft aangetoond dat de index wordt opgebouwd op basis van de geïmporteerde offers uit [data/phase1a-proof/offers.json](../data/phase1a-proof/offers.json) en dat zoekopdrachten op basis van bestemming en hotelnaam correcte resultaten opleveren.

### Persistente indexoutput

Bestand:
- [data/phase1a-proof/offers-index.json](../data/phase1a-proof/offers-index.json)

### Bewijsoutput

```json
{
  "indexPath": "C:\\Users\\koenm\\Documents\\VacationWeb\\VScode_vacationweb_app\\data\\phase1a-proof\\offers-index.json",
  "documents": [
    {
      "id": "cor-1001",
      "externalId": "cor-1001",
      "hotelName": "Hotel Palma Bay",
      "destination": "Mallorca",
      "country": "Spain",
      "region": "Balearic Islands",
      "price": 689,
      "currency": "EUR",
      "nights": 7,
      "boardType": "All Inclusive",
      "departureDate": "2026-07-10",
      "provider": "Corendon"
    },
    {
      "id": "cor-1002",
      "externalId": "cor-1002",
      "hotelName": "Hotel Playa Azul",
      "destination": "Tenerife",
      "country": "Spain",
      "region": "Canary Islands",
      "price": 799,
      "currency": "EUR",
      "nights": 8,
      "boardType": "Half Board",
      "departureDate": "2026-07-18",
      "provider": "Corendon"
    }
  ],
  "queries": {
    "mallorca": [
      {
        "externalId": "cor-1001",
        "hotelName": "Hotel Palma Bay",
        "destination": "Mallorca"
      }
    ],
    "palma": [
      {
        "externalId": "cor-1001",
        "hotelName": "Hotel Palma Bay",
        "destination": "Mallorca"
      }
    ],
    "tenerife": [
      {
        "externalId": "cor-1002",
        "hotelName": "Hotel Playa Azul",
        "destination": "Tenerife"
      }
    ]
  }
}
```

---

## Conclusie

US-09 is nu gerealiseerd als een minimale, werkende zoekindex over geïmporteerde offers. De index ondersteunt zoeken op bestemming, hotelnaam en andere kernvelden, en is getest met concrete proof-data.
