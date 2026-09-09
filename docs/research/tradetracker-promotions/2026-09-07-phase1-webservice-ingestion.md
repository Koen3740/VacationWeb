# TradeTracker promotion webservice ingestion — phase 1

## Datum

2026-09-07 (implementatie) · live SOAP-bewijs 2026-09-09 · VacationWeb-site scope 2026-09-09

## Doel

Officiële TradeTracker Affiliate Webservice-data (campagnes, campaign news, incentive offers, vouchers) ophalen, normaliseren en veilig beschikbaar maken voor latere productfasen — **scoped op VacationWeb**.

## Scope

Data ingestion only. Geen UI, geen Aanbiedingen/Last Minute/homepage, geen catalogus- of pricingwijzigingen, geen commerciële ranking.

## VacationWeb affiliate site

| | |
|--|--|
| **VacationWeb affiliateSiteID** | **512226** (`Vacationweb.nl`) |
| Niet gebruiken als VW-context | 512055 (`MKDigitalMedia`) |

Ingest default = `512226` (`VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID`). Optioneel override via `TRADETRACKER_AFFILIATE_SITE_ID` (research only).

`getCampaigns`, incentive offers en vouchers worden met `affiliateSiteID=512226` aangeroepen. Account-wide `getCampaignNewsItems` wordt gefilterd tot news waarvan `campaignId` tot de 512226-campagne-set behoort.

## Bestaande TradeTracker-infrastructuur

VacationWeb had al **productfeed XML-import** (`config/feed-manifest.json`, `lib/feeds/*`, `format: tradetracker-xml`). Dat pad blijft ongewijzigd.

SOAP promotion-laag: `lib/tradetracker/promotions/` + CLI `npm run ingest:tradetracker-promotions`.

## Gebruikte Webservice-methodes

- `authenticate`
- `getAffiliateSites`
- `getCampaigns(affiliateSiteID=512226)`
- `getCampaignNewsItems` (daarna gefilterd op VW-campagne-IDs)
- `getMaterialIncentiveOfferItems(affiliateSiteID=512226)`
- `getMaterialIncentiveVoucherItems(affiliateSiteID=512226)`

## WSDL / endpoint

- WSDL: `https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl`
- Namespace: `https://ws.tradetracker.com/soap-literal-wsi/affiliate`
- SOAP 1.2 document/literal WSI
- Client: npm `soap` (WSDL-driven)
- Sessie: `Set-Cookie` na `authenticate` → `Cookie`

## Authenticatie

- `TRADETRACKER_CUSTOMER_ID` / `TRADETRACKER_ACCESS_KEY` in gitignored `.env.local`
- namen in `.env.example` zonder waarden

## Interne normalisatie

Snapshot (`TradeTrackerPromotionSnapshot`) met `scopedAffiliateSiteId` onderscheidt:

- `campaign`
- `campaign_news` / `campaign_start` / `campaign_stop` / `campaign_update`
- `consumer_promotion` (label voor `campaign_update_consumer`; geen deal)
- `incentive_offer`
- `voucher`

Bronvelden blijven behouden. Campaign IDs komen uit TradeTracker. Campaign news ≠ automatisch een “aanbieding”.

## Datumvalidatie

UTC-kalenderdatum (`timezoneAssumption: utc-calendar-date`):

- toekomstig → `scheduled`, niet actief
- verlopen → `expired`, niet actief
- geen `expirationDate` → niet kunstmatig verlopen
- geen `publishDate` → `undated`, niet actief
- einddatum = vandaag UTC → die dag nog actief

## Runtime-test (live, affiliateSiteID 512226)

CLI: `npm run ingest:tradetracker-promotions`  
Snapshot (gitignored): `data/tradetracker-promotions/snapshot-vacationweb-512226.json`

### Eerdere account-brede run (onvoldoende als VW-bewijs)

2026-09-09 ~17:02Z: sites 2, campaigns **2946**, news 109, vouchers 1 — **beide** affiliate sites. Niet gebruiken als VacationWeb-scope-bewijs.

### VacationWeb-scope run (bewijs)

**2026-09-09 — SUCCESS** (~4,0 s, `methodErrors: 0`)

| Meting | Waarde |
|--------|--------|
| scopedAffiliateSiteId | **512226** |
| Affiliate sites in snapshot | 1 (`Vacationweb.nl`) |
| Campaigns | **1473** |
| Campaign news (na VW-filter) | **104** |
| Active campaign news | **104** |
| Incentive offers | **0** |
| Vouchers | **0** |

NewsTypes (512226-run):

| Type | Count |
|------|------:|
| `campaign_update_consumer` | 41 |
| `campaign_update_general` | 24 |
| `campaign_start` | 11 |
| `campaign_stop` | 9 |
| `campaign_update_commission` | 9 |
| `campaign_update_feed` | 4 |
| `campaign_update_material` | 3 |
| `campaign_update_vouchercode` | 2 |
| `campaign_update_urgent` | 1 |

Opmerking: de eerdere account-brede voucher (1) hoorde niet bij de 512226-scope; op VacationWeb-site zijn vouchers in deze run **0**.

## Testresultaten

Unit tests `lib/tradetracker/promotions/*.test.ts`: normalisatie, 512226-scope (excl. 512055), news-filter, newsType, datums, incentive/voucher, malformed/API errors, ontbrekende credentials, geen secret-leak.

Live SOAP voor **512226**: bewezen (zie Runtime-test).

## Beperkingen

- Snapshot is momentopname.
- Incentive HTML `code` niet als productcopy; alleen `hasMaterialCode`.
- Geen koppeling naar offers.json / live pricing / Results.
- Geen VacationWeb productfilter op campagne-namen in deze fase (alle TT-campagnes op site 512226).

## Openstaande punten

- Productfase: welke bronrecords (indien enige) op Aanbiedingen mogen.
- Eventuele mapping TT-campagne ↔ VacationWeb provider-identity blijft productwerk.

## Bewust NIET geïmplementeerd

- Aanbiedingen UI, header, homepage, Last Minute UI/feeds
- Catalogus-, pricing-, results-, sort-, search-, airport-wijzigingen
- Nieuwe providerfeeds / feedmapping
- Dealranking / commerciële selectie / afgeleide kortingsclaims
- Deployment
