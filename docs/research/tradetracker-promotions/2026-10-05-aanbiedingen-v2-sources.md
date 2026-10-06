# Aanbiedingen V2 — Corendon-homepageacties, 2026-10-05

## Wat de pagina toont

Twee acties, gezet in typografie. Het bedrag komt van de Corendon-homepage zoals de eigenaar die na een trackingklik zag. Het staat niet in TradeTracker-SOAP.

| Actie | Bedrag | Landing in de CTA |
| --- | --- | --- |
| Warme Winter Weken | tot €600 extra korting | `https://www.corendon.nl/winterzon` of `https://www.corendon.be/winterzon` |
| Last minutes | tot €200 extra korting, oktober en november | `https://www.corendon.nl/topdeals` of `https://www.corendon.be/topdeals` |

De landings zijn de `url` van de live homepage-banners (groep 15423 naar `/winterzon`, groep 15424 naar `/topdeals`). Kidskorting en filterdata zijn niet overgenomen.

Bestemmingen staan alleen omdat ze in de zichtbare zin op die landings staan, opgehaald op 2026-10-05:

- `https://www.corendon.nl/winterzon`: “naar populaire winterzonbestemmingen zoals Egypte en de Canarische Eilanden.”
- `https://www.corendon.be/winterzon`: “zoals Curaçao, Bonaire, Kaapverdië, Gambia, Turkije, Spanje en Egypte.”
- `https://www.corendon.nl/topdeals` en `https://www.corendon.be/topdeals`, titel “Last Minutes oktober en november”, zin “Last minute naar de zon in oktober of november?”

## Affiliatepad

De feed-structuur is `https://referral.corendon.nl/c?c=38108&m=…&a=512226&r=&u=<encodedLanding>`. België: `referral.corendon.be`, `c=38103`, `a=511873`. Het campagne-`trackingURL` is dezelfde vorm met `m=0` en een lege `u`. De CTA is dat template plus de gecodeerde actiepagina, en gaat daarna door `promotionClickHref`.

Er is in deze correctie geen nieuwe aanroep van `/c`. End-to-end attributie van `m=0` is niet opnieuw getest.

## V4 — brede kaarten en automatische stroom

Elke aanbieding is dezelfde brede kaart, onder elkaar. Er is geen hero, geen dagrotatie en geen verschil in kaartgrootte per provider. Eén aanbieding is één volle kaart.

Sorteersleutel in `sort-offers.ts`, eerste datum die de bron echt heeft:

1. `publishedAt` — bij een creative het bestaande `validFromDate` (op de kaart als `publishDate`); bij campaign news het bestaande `publishDate`.
2. `validFrom` — alleen als die apart van de publicatiedatum bewaard is.
3. `ingestedAt` — `fetchedAt` van de creative, of `ingestedAt` van de promotionsnapshot.

Een datum `YYYY-MM-DD` telt als UTC-kalenderdag. Een volledige timestamp telt als absoluut tijdstip. De nieuwste staat bovenaan. Zonder datum zakt de aanbieding onder elke gedateerde aanbieding. Bij een gelijke sleutel beslist `id` aflopend. Dat is alleen een stabiele volgorde. De hardcoded Corendon-homepageacties zijn geen bron en geen fallback. Levert TradeTracker geen concrete actie, dan toont de pagina geen aanbiedingen.

De pagina is `force-dynamic`. Bij een request leest `loadAanbiedingenByMarkets` de geselecteerde creative-snapshots en, via `loadDisplayablePromotionsForMarket`, de SOAP-promoties met een cache van 15 minuten. Nieuwe en gewijzigde TradeTracker-acties met een concreet voordeel komen zo op de pagina zonder dat de eigenaar ze invoert. Een creative met `validity.status === 'expired'` valt af in `select-creatives`. News, incentives en vouchers zonder `validity.isActive` vallen af in `select-displayable`. Een kaart waarvan `expirationDate` vóór de UTC-dag van vandaag ligt, valt daarna nog eens af in `editorialOffersFromCards`.

Een aanbieding bestaat alleen bij een concreet voordeel: bedrag, percentage, voucher, of een benoemd gratis voordeel (`1 kind gratis`, `2e persoon gratis`, `gratis bagage`, `gratis transfer`). “Last Minute”, “Zonvakantie”, “Boek nu”, “Ontdek Corendon” en een kale “gratis” zijn geen aanbieding. Een TradeTracker-creative is daardoor niet vanzelf een kaart.

## Beelden

De HPTO-URL’s op `images.corendonresources.com` zijn alleen bronbewijs. Ze worden niet gehotlinkt, niet gedownload, niet gehost, en niet in `tradetracker-creatives` of R2 gezet. Materialen 2499691–2499698 en 2499700 blijven buiten de pagina, ook als beeld.

Een campagnefoto wordt alleen gebruikt als het een eigen VacationWeb-pad is onder `/aanbiedingen/creative-images/` (canonical site NL 512226 of BE 511873). De originele verhouding wordt niet uitgerekt: de foto vult de linkerhelft van de brede kaart met `object-cover`. Ook 780×320 mag zo. Een smalle staande banner wordt niet over de volle kaartbreedte getrokken.

Zonder zo’n bestand blijft de actie staan, gezet in type: licht vlak, provider, groot voordeel, de actietitel en de CTA. Er is geen getekende kust, geen neppe vakantiefoto en geen homepage-sfeerfoto.

De verversing is één entrypoint, `npm run refresh:tradetracker-creatives`: creative-ingest, selectie, daarna server-side beeldingest. Er staat geen aparte nightly scheduler in deze repository. Een eigen beeld hoort bij de creative zelf. Zonder toegestaan bestand blijft een echte actie typografisch.

Catalogus, `current.json` en live-price zijn niet aangeraakt.

## Wat niet terugkomt

- Materialen 2499691–2499698 en 2499700.
- “Vacances Last Minute” zonder bedrag.
- Kaching, inclusief news 322951 en 322932.
- Technische uitleg op de pagina.
- CorendonResources-bestanden als campagnebeeld.
