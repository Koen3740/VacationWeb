# US-01 t.e.m. US-07 Verification Report

Status: Gecontroleerd en gevalideerd  
Datum: 2026-06-24  
Scope: End-to-end proof van de volledige ingest-keten voor Corendon vanaf providerregistratie tot prijsopslag.

## Doel van dit document

Dit document levert één centraal bewijs dat de volledige keten werkt:

Provider → Feed → Download → Parser → Mapping → Validatie → Database → Prijsopslag

Het document is gebaseerd op de meest recente geverifieerde proof-run van de implementatie.

---

## 1. Betrokken bestanden

- [lib/feeds/registry.js](../lib/feeds/registry.js)
- [lib/feeds/fetcher.js](../lib/feeds/fetcher.js)
- [lib/feeds/parser.js](../lib/feeds/parser.js)
- [lib/feeds/validator.js](../lib/feeds/validator.js)
- [lib/feeds/repository.js](../lib/feeds/repository.js)
- [lib/feeds/pipeline.js](../lib/feeds/pipeline.js)
- [lib/feeds/pricing.js](../lib/feeds/pricing.js)
- [lib/feeds/phase1a.integration.test.js](../lib/feeds/phase1a.integration.test.js)
- [lib/feeds/fixtures/corendon-feed.sample.json](../lib/feeds/fixtures/corendon-feed.sample.json)
- [data/phase1a-proof/feed-registry.json](../data/phase1a-proof/feed-registry.json)
- [data/phase1a-proof/raw-feed.json](../data/phase1a-proof/raw-feed.json)
- [data/phase1a-proof/offers.json](../data/phase1a-proof/offers.json)
- [data/phase1a-proof/price-history.json](../data/phase1a-proof/price-history.json)

---

## 2. Logisch database schema

De huidige implementatie gebruikt file-backed JSON stores. Het logische schema is daarom als volgt:

```json
{
  "providers": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "createdAt": "datetime"
    }
  ],
  "feeds": [
    {
      "id": "string",
      "providerId": "string",
      "name": "string",
      "status": "string",
      "sourceType": "string",
      "createdAt": "datetime"
    }
  ],
  "hotels": [
    {
      "hotelName": "string",
      "destination": "string",
      "country": "string",
      "region": "string"
    }
  ],
  "offers": [
    {
      "externalId": "string",
      "hotelName": "string",
      "destination": "string",
      "country": "string",
      "region": "string",
      "price": "number",
      "currency": "string",
      "nights": "number",
      "boardType": "string",
      "departureDate": "string",
      "provider": "string"
    }
  ],
  "offer_prices": [
    {
      "externalId": "string",
      "price": "number",
      "updatedAt": "datetime"
    }
  ]
}
```

---

## 3. Providers tabel

```json
[
  {
    "id": "provider-1782334901848",
    "name": "Corendon",
    "type": "tour-operator",
    "createdAt": "2026-06-24T21:01:41.848Z"
  }
]
```

---

## 4. Feeds tabel

```json
[
  {
    "id": "feed-1782334901851",
    "providerId": "provider-1782334901848",
    "name": "Corendon primary feed",
    "status": "active",
    "sourceType": "json",
    "createdAt": "2026-06-24T21:01:41.851Z"
  }
]
```

---

## 5. Hotels tabel

```json
[
  {
    "hotelName": "Hotel Palma Bay",
    "destination": "Mallorca",
    "country": "Spain",
    "region": "Balearic Islands"
  }
]
```

---

## 6. Offers tabel

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

---

## 7. Offer_prices tabel

```json
[
  {
    "externalId": "cor-1001",
    "price": 689,
    "updatedAt": "2026-06-24T21:01:41.859Z"
  }
]
```

---

## 8. Gebruikte bronfeed

Bron: [lib/feeds/fixtures/corendon-feed.sample.json](../lib/feeds/fixtures/corendon-feed.sample.json)

```json
{
  "provider": "Corendon",
  "generatedAt": "2026-06-24T00:00:00.000Z",
  "offers": [
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
      "departureDate": "2026-07-10"
    }
  ]
}
```

---

## 9. Parser output

```json
{
  "provider": "Corendon",
  "generatedAt": "2026-06-24T00:00:00.000Z",
  "offers": [
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
}
```

---

## 10. Canonical TravelOffer output

```json
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
```

---

## 11. Validatieresultaten

```json
{
  "valid": [
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
  ],
  "invalid": []
}
```

---

## 12. Verwerkte records

- Totaal verwerkt: 1
- Succesvolle records: 1
- Afgewezen records: 0

---

## 13. Voorbeeldrecords

### Voorbeeld opgeslagen hotelrecord

```json
{
  "hotelName": "Hotel Palma Bay",
  "destination": "Mallorca",
  "country": "Spain",
  "region": "Balearic Islands"
}
```

### Voorbeeld opgeslagen offerrecord

```json
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
```

### Voorbeeld opgeslagen prijsrecord

```json
{
  "externalId": "cor-1001",
  "price": 689,
  "updatedAt": "2026-06-24T21:01:41.859Z"
}
```

---

## 14. Integratietest output

Commando:

```bash
node --test lib/feeds/phase1a.integration.test.js
```

Uitvoer:

```text
✔ US-01 through US-07 complete an end-to-end Corendon ingest flow (17.3297ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

---

## 15. Logging output

```json
{
  "registryResult": {
    "provider": {
      "id": "provider-1782334901848",
      "name": "Corendon",
      "type": "tour-operator",
      "createdAt": "2026-06-24T21:01:41.848Z"
    },
    "feed": {
      "id": "feed-1782334901851",
      "providerId": "provider-1782334901848",
      "name": "Corendon primary feed",
      "status": "active",
      "sourceType": "json",
      "createdAt": "2026-06-24T21:01:41.851Z"
    }
  },
  "fetchResult": {
    "status": "stored",
    "payloadPath": "C:\\Users\\koenm\\Documents\\VacationWeb\\VScode_vacationweb_app\\data\\phase1a-proof\\raw-feed.json",
    "provider": "Corendon",
    "offerCount": 1
  },
  "validation": {
    "valid": [
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
    ],
    "invalid": []
  },
  "ingestResult": {
    "savedCount": 1,
    "invalidCount": 0,
    "storePath": "C:\\Users\\koenm\\Documents\\VacationWeb\\VScode_vacationweb_app\\data\\phase1a-proof\\offers.json"
  },
  "priceResult": {
    "count": 1,
    "storePath": "C:\\Users\\koenm\\Documents\\VacationWeb\\VScode_vacationweb_app\\data\\phase1a-proof\\price-history.json",
    "entry": {
      "externalId": "cor-1001",
      "price": 689,
      "updatedAt": "2026-06-24T21:01:41.859Z"
    }
  }
}
```

---

## 16. Database query resultaten / persisted store resultaten

```json
{
  "providerRows": [
    {
      "id": "provider-1782334901848",
      "name": "Corendon",
      "type": "tour-operator",
      "createdAt": "2026-06-24T21:01:41.848Z"
    }
  ],
  "feedRows": [
    {
      "id": "feed-1782334901851",
      "providerId": "provider-1782334901848",
      "name": "Corendon primary feed",
      "status": "active",
      "sourceType": "json",
      "createdAt": "2026-06-24T21:01:41.851Z"
    }
  ],
  "hotelRows": [
    {
      "hotelName": "Hotel Palma Bay",
      "destination": "Mallorca",
      "country": "Spain",
      "region": "Balearic Islands"
    }
  ],
  "offerRows": [
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
  ],
  "priceRows": [
    {
      "externalId": "cor-1001",
      "price": 689,
      "updatedAt": "2026-06-24T21:01:41.859Z"
    }
  ]
}
```

---

## Conclusie

De volledige keten voor US-01 t.e.m. US-07 is geverifieerd met concreet bewijs:

- providerregistratie werkt
- feeddownload en opslag werken
- parsing werkt
- mapping naar canonical offer werkt
- validatie werkt
- persistence werkt
- prijsopslag werkt

Na goedkeuring van dit document kan worden overgegaan naar US-09.
