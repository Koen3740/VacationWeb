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

## Beelden

De HPTO-URL’s op `images.corendonresources.com` zijn alleen bronbewijs. Ze worden niet gehotlinkt, niet gedownload, niet gehost, en niet in `tradetracker-creatives` of R2 gezet. Er is geen TradeTracker-creative voor deze twee acties. Materialen 2499691–2499698 en 2499700 blijven buiten de pagina. Daarom is het beeld de typografie: het bedrag is het visuele middelpunt.

Catalogus, `current.json` en live-price zijn niet aangeraakt.

## Wat niet terugkomt

- Materialen 2499691–2499698 en 2499700.
- “Vacances Last Minute” zonder bedrag.
- Kaching, inclusief news 322951 en 322932.
- Technische uitleg op de pagina.
- CorendonResources-bestanden als campagnebeeld.
