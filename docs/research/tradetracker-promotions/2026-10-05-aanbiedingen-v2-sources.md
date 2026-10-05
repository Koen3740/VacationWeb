# Aanbiedingen V2 — bronnen en blocker, 2026-10-05

## Wat de pagina toont

Geen Corendon-homepageactie. TradeTracker-nieuws en de Corendon-bannermaterialen bevatten die claims niet. De pagina blijft leeg tot een bedrag in die bron staat.

Afgewezen en niet zichtbaar:

- BE Banner*-lastminute materialen `2499691`–`2499698` en `2499700`. Die waren “displayable” alleen door het woord lastminute, zonder aangetoond eurobedrag.
- Generieke banners, waaronder “Vacances Last Minute”.
- Kaching, inclusief news `322951` en `322932`. Geen aangetoond verband met een last-minute actie voor oktober–november.

## Homepageclaims die niet in TradeTracker staan

Warme Winter Weken / tot €600 en Last minute oktober–november / tot €200 zijn na een trackingklik op corendon.nl als UI-claim gezien. Ze zijn afwezig in TradeTracker-nieuws en in alle Corendon SOAP-banners (geen keyword-hit op winter, warme, last minute, 600, 200 of HPTO). Sub30 vond ze niet in bannertitels. Er zit geen 780×320 HPTO tussen de TradeTracker-banners.

Die bedragen en data worden daarom niet op `/aanbiedingen` gezet. Een landingpage overnemen zou een bedrag toeschrijven dat TradeTracker niet levert.

## HPTO-beelden

HEAD op 2026-10-05, alleen bestandsbestaan. De pixeltekst is niet overgenomen.

| URL | Status | Type | Lengte | Last-Modified |
| --- | --- | --- | --- | --- |
| `https://images.corendonresources.com/NL/HPTO_WWW_NL_Toplaag_Header_780x320.png` | 200 | image/png | 146596 | Wed, 23 Sep 2026 09:30:51 GMT |
| `https://images.corendonresources.com/NL/HPTO_LastMinute_NL_Toplaag_Header_780x320.png` | 200 | image/png | 56434 | Wed, 23 Sep 2026 14:57:38 GMT |
| `https://images.corendonresources.com/NL/HPTO_WWW_NL_Toplaag_Header_780x320.jpg` | 404 | | | |
| `https://images.corendonresources.com/NL/HPTO_LastMinute_NL_Toplaag_Header_780x320.jpg` | 404 | | | |
| `https://images.corendonresources.com/NL/HPTO_WWW_verlengd_NL_Toplaag_Header_780x320.png` | 200 | image/png | 184451 | Tue, 04 Nov 2025 16:05:20 GMT |
| `https://images.corendonresources.com/NL/HPTO_WWW_NL_Topbanner_1168x500.jpg` | 200 | image/jpeg | 481071 | Wed, 23 Sep 2026 09:30:50 GMT |
| `https://images.corendonresources.com/NL/HPTO_LastMinute_NL_Topbanner_1168x500.jpg` | 200 | image/jpeg | 393590 | Wed, 23 Sep 2026 14:57:39 GMT |

De twee 780×320 PNG’s zijn het patroon uit Sub29–32B. Ze komen niet uit TradeTracker `/i`. Er is geen opgeslagen `/c`-template die naar deze bestandsnamen wijst. Bestaande templates zijn `https://referral.corendon.{nl|be}/c?c=38108|38103&m=…&a=…` voor bannermateriaal.

De pagina rendert deze URL’s niet. Een beeld-`src` mag alleen `/aanbiedingen/creative-images/…` zijn. Zonder kortingstekst in TradeTracker is een homepagebeeld geen aanbieding.

## Klaar voor een latere bron

`editorialOffersFromCards` zet een TradeTracker-kaart pas op de pagina als het bedrag of percentage al in de kaart staat, de aanbieder Corendon, Sunweb of Eliza is, en het materiaal niet in de afgewezen lastminute-lijst zit. De klik blijft `promotionClickHref` op het opgeslagen `/c`-template. Beelden blijven VacationWeb-paden onder `/aanbiedingen/creative-images/`. Smalle bannerformaten sturen de layout niet.
