# Aanbiedingen V2 — bronnen, 2026-10-06

De live pagina toont alleen gepubliceerde creative-snapshots. De Corendon-homepageacties hieronder zijn historisch bronbewijs en een testfixture. Ze zijn geen productiebron en geen fallback.

## Historische homepageacties (niet live)

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

De pagina is `force-dynamic` en leest alleen gepubliceerde VacationWeb-data: `selected-nl-512226.json`, `selected-be-511873.json` en `creative-image-manifest.json`. Lokaal bestand eerst, anders het object onder `tradetracker-creatives/` in R2. Die R2-read zit in een cache van 5 minuten (`unstable_cache`, revalidate 300). Een bezoek roept TradeTracker niet aan. Er is geen campaign-newsfeed op het requestpad.

Een creative met `validity.status === 'expired'` valt af in `select-creatives`. Een kaart waarvan `expirationDate` vóór de UTC-dag van vandaag ligt, valt daarna nog eens af in `editorialOffersFromCards`. Levert de snapshot geen kaart op, dan toont de pagina “Momenteel zijn er geen actuele aanbiedingen.” en een link naar home (`Zoek een vakantie`). Geen debugtekst en geen homepage-aanbieding.

Een aanbieding bestaat alleen bij een concreet voordeel: bedrag, percentage, voucher, of een benoemd gratis voordeel (`1 kind gratis`, `2e persoon gratis`, `gratis bagage`, `gratis transfer`). “Last Minute”, “Zonvakantie”, “Boek nu”, “Ontdek Corendon” en een kale “gratis” zijn geen aanbieding. Een TradeTracker-creative is daardoor niet vanzelf een kaart.

## Beelden

De HPTO-URL’s op `images.corendonresources.com` zijn alleen bronbewijs. Ze worden niet gehotlinkt, niet gedownload, niet gehost, en niet in `tradetracker-creatives` of R2 gezet. Materialen 2499691–2499698 en 2499700 blijven buiten de pagina, ook als beeld.

Een campagnefoto wordt alleen gebruikt als het een eigen VacationWeb-pad is onder `/aanbiedingen/creative-images/` (canonical site NL 512226 of BE 511873). De originele verhouding wordt niet uitgerekt: de foto vult de linkerhelft van de brede kaart met `object-cover`. Ook 780×320 mag zo. Een smalle staande banner wordt niet over de volle kaartbreedte getrokken.

Zonder zo’n bestand blijft de actie staan, gezet in type: licht vlak, provider, groot voordeel, de actietitel en de CTA. Er is geen getekende kust, geen neppe vakantiefoto en geen homepage-sfeerfoto.

De verversing is één functie, `refreshTradeTrackerCreatives`. `npm run refresh:tradetracker-creatives` en de cron-route roepen diezelfde functie aan: creative-ingest, selectie, benefit-filter, server-side beeldingest, daarna pas de snapshot en als laatste het image-manifest. Een eigen beeld hoort bij de creative zelf, onder `/aanbiedingen/creative-images/` (R2-prefix `tradetracker-creatives/images/`). Zonder toegestaan bestand blijft een echte actie typografisch.

## Dagelijkse cron

`vercel.json` plant één job: `17 2 * * *` op `/api/cron/tradetracker-creatives`. Dat is 02:17 UTC, 04:17 CEST en 03:17 CET. Op Vercel Hobby valt de start binnen dat uur, niet op de minuut. De route is Node.js, `maxDuration` 60. Vercel stuurt `Authorization: Bearer <CRON_SECRET>`. Zonder secret, of met een andere bearer, antwoordt de route 401 en draait de refresh niet. Op Vercel schrijft de run alleen onder `/tmp` en naar de bestaande R2-sleutels.

## Fail-safe

Een mislukte ingest, selectie of R2-fout publiceert de snapshot van die markt niet. NL (`512226`) en BE (`511873`) staan apart: een fout in de ene markt laat de laatste geldige snapshot van de andere staan. Het gedeelde manifest wordt bij een gedeeltelijke run alleen bijgewerkt met de geslaagde markt; entries van de andere markt blijven. Een geslaagde run met 0 toonbare aanbiedingen is wél een publicatie, zodat een verdwenen campagne ook verdwijnt. De cron eist een geslaagde R2-publicatie (`requireRemote`). De npm-run op een machine zonder object storage schrijft lokaal en laat R2 met rust.

## TradeTracker-context

Eén TradeTracker-account. NL gebruikt `TRADETRACKER_CUSTOMER_ID` en `TRADETRACKER_ACCESS_KEY`, site 512226, campagne 38108. BE gebruikt `TRADETRACKER_BE_CUSTOMER_ID` en `TRADETRACKER_BE_ACCESS_KEY`, site 511873, campagne 38103. Alleen providers Corendon, Sunweb en Eliza was here kunnen een kaart worden. Een creative zonder concreet voordeel (bedrag, percentage, voucher of een benoemd gratis voordeel) blijft uit de pagina.

## Wat niet is gebouwd

Campaign News is een mogelijke latere ontdekkings- of triggerlaag. Die laag draait niet in de creative-refresh en niet op `/aanbiedingen`. Mailbox-, Outlook- of Graph-integratie is niet gebouwd. Er is geen tweede refreshketen en geen tweede R2-store.

Catalogus, `current.json`, live-price en de productfeed zijn niet aangeraakt.

De homepage-header en -footer linken “Aanbiedingen” naar `/aanbiedingen`. Het resultaten-menu deed dat al. Er is geen teller en geen badge.

## Wat niet terugkomt

- Materialen 2499691–2499698 en 2499700.
- “Vacances Last Minute” zonder bedrag.
- Kaching, inclusief news 322951 en 322932.
- Technische uitleg op de pagina.
- CorendonResources-bestanden als campagnebeeld.
