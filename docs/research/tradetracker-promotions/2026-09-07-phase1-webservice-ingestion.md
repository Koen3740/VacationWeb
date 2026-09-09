# TradeTracker promotion webservice ingestion — phase 1

## Datum

2026-09-07 (implementatie) · live SOAP-bewijs 2026-09-09

## Doel

Officiële TradeTracker Affiliate Webservice-data (campagnes, campaign news, incentive offers, vouchers) ophalen, normaliseren en veilig beschikbaar maken voor latere productfasen.

## Scope

Data ingestion only. Geen UI, geen Aanbiedingen/Last Minute/homepage, geen catalogus- of pricingwijzigingen, geen commerciële ranking.

## Bestaande TradeTracker-infrastructuur

VacationWeb had al **productfeed XML-import** (`config/feed-manifest.json`, `lib/feeds/*`, `format: tradetracker-xml`). Dat pad blijft ongewijzigd.

Er was **geen** SOAP Affiliate-client, geen promotion/campaign-ingestielaag, en geen `TRADETRACKER_*` credentials in de bestaande env-conventie (Object Storage + gitignored `.env.local`).

Deze fase voegt een **geïsoleerde** module toe: `lib/tradetracker/promotions/`. Geen tweede feed-importer en geen wijziging van bestaande provider-feedmapping.

## Gebruikte Webservice-methodes

- `authenticate`
- `getAffiliateSites`
- `getCampaigns`
- `getCampaignNewsItems`
- `getMaterialIncentiveOfferItems`
- `getMaterialIncentiveVoucherItems`

## WSDL / endpoint

- WSDL: `https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl`
- Namespace: `https://ws.tradetracker.com/soap-literal-wsi/affiliate`
- SOAP 1.2 document/literal WSI
- Client: npm `soap` (WSDL-driven; geen handmatig gegokte envelopes)
- Sessie: `Set-Cookie` na `authenticate` wordt als `Cookie` hergebruikt

## Authenticatie

Environment variables (zelfde lokale conventie als Object Storage: `.env.local`, nooit in Git):

- `TRADETRACKER_CUSTOMER_ID` (WSDL `customerID`)
- `TRADETRACKER_ACCESS_KEY` (WSDL `passphrase`)
- optioneel: `TRADETRACKER_LOCALE` (default `nl_BE`), `TRADETRACKER_SANDBOX`, `TRADETRACKER_DEMO`, `TRADETRACKER_AFFILIATE_SITE_ID`

Namen van variabelen staan in `.env.example` zonder waarden.

## Interne normalisatie

Snapshot-model (`TradeTrackerPromotionSnapshot`) onderscheidt:

- `campaign`
- `campaign_news` / `campaign_start` / `campaign_stop` / `campaign_update`
- `consumer_promotion` (alleen bronlabel voor `campaign_update_consumer`; geen deal-classificatie)
- `incentive_offer`
- `voucher`

Bronvelden (IDs, namen, URLs, newsType, datums, advertiser/campaign identity, raw key metadata) blijven behouden. Campaign IDs komen uit TradeTracker; geen hardcoded Corendon/Sunweb/Eliza-IDs.

Campaign news is broninformatie. Niet ieder news-item is een “aanbieding”.

## Datumvalidatie

TradeTracker `xsd:date` wordt als kalenderdatum `YYYY-MM-DD` gelezen.

Vergelijking gebruikt de **UTC-kalenderdatum** van `asOfMs` (`timezoneAssumption: utc-calendar-date`). Geen stille Europe/Amsterdam-conversie. `campaign.info.timeZone` wordt bewaard, niet stil toegepast.

- nog niet gepubliceerd (`start` > vandaag UTC) → `scheduled`, niet actief
- verlopen (`end` < vandaag UTC) → `expired`, niet actief
- ontbrekende `end`/`expirationDate` → niet kunstmatig verlopen
- ontbrekende `start`/`publishDate` → `undated`, niet actief
- `end` gelijk aan vandaag UTC blijft die dag actief

News gebruikt `publishDate`/`expirationDate`. Incentives gebruiken `validFromDate`/`validToDate`.

## Runtime-test (live)

CLI: `npm run ingest:tradetracker-promotions`  
Snapshot (gitignored JSON): `data/tradetracker-promotions/snapshot.json`

**2026-09-09T17:02:36.166Z — SUCCESS** (wall ~6,3 s, `methodErrors: 0`)

| Meting | Waarde |
|--------|--------|
| WSDL | `https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl` |
| Affiliate sites | 2 (`512055` MKDigitalMedia, `512226` Vacationweb.nl) |
| Campaigns | 2946 |
| Campaign news | 109 (alle 109 `validity.isActive` op capture-moment) |
| Incentive offers | 0 |
| Vouchers | 1 (actief) |

NewsType-verdeling (deze run):

| Type | Count |
|------|------:|
| `campaign_update_consumer` | 42 |
| `campaign_update_general` | 26 |
| `campaign_start` | 11 |
| `campaign_stop` | 10 |
| `campaign_update_commission` | 9 |
| `campaign_update_feed` | 5 |
| `campaign_update_material` | 3 |
| `campaign_update_vouchercode` | 2 |
| `campaign_update_urgent` | 1 |

Bewerkte methodes in deze run: authenticate, getAffiliateSites, getCampaigns, getCampaignNewsItems, getMaterialIncentiveOfferItems, getMaterialIncentiveVoucherItems — allemaal zonder method-error.

Geen credentials of passphrases in logs/snapshot-rapportage.

## Testresultaten

Unit tests: `lib/tradetracker/promotions/*.test.ts` (normalisatie, identity, newsType, datums, incentives vs vouchers, malformed/API errors, ontbrekende credentials zonder file-load, geen secret-leak).

Live SOAP: **bewezen** (zie Runtime-test).

## Beperkingen

- Snapshot is één momentopname; counts wijzigen in TT.
- Incentive HTML `code` wordt niet als productcopy gebruikt; alleen metadata (`hasMaterialCode`).
- Geen koppeling naar offers.json / live pricing / Results.
- Campagne-lijst bevat alle TT-campagnes op de affiliate sites; geen VacationWeb productfilter in deze fase.

## Openstaande punten

- Productfase: welke bronrecords (indien enige) op een Aanbiedingen-pagina mogen.
- Eventueel site-scope via `TRADETRACKER_AFFILIATE_SITE_ID` als alleen Vacationweb.nl gewenst is.

## Bewust NIET geïmplementeerd

- Aanbiedingen UI, header, homepage, Last Minute UI/feeds
- Catalogus-, pricing-, results-, sort-, search-, airport-wijzigingen
- Nieuwe providerfeeds of feedmapping-wijzigingen
- Automatische dealranking / commerciële selectie / afgeleide kortingsclaims
- Deployment
