# Aanbiedingen V2 — Corendon-homepageacties, 2026-10-05

## Wat de pagina toont

Twee acties. Het bedrag komt van de Corendon-homepage zoals de eigenaar die na een trackingklik zag, niet uit TradeTracker-SOAP.

| Actie | Bedrag | Landing in de CTA | Beeld |
| --- | --- | --- | --- |
| Warme Winter Weken | tot €600 extra korting | `https://www.corendon.nl/winterzon` of `https://www.corendon.be/winterzon` | `HPTO_WWW_NL_Toplaag_Header_780x320.png` |
| Last minutes | tot €200 extra korting, oktober en november | `https://www.corendon.nl/topdeals` of `https://www.corendon.be/topdeals` | `HPTO_LastMinute_NL_Toplaag_Header_780x320.png` |

De landings zijn de `url` van de live homepage-banners (groep 15423 naar `/winterzon`, groep 15424 naar `/topdeals`). Die pagina’s bevatten dezelfde bedragen in de zichtbare tekst. Kidskorting en filterdata zijn niet overgenomen. NL en BE noemen andere winterbestemmingen; de tekst blijft per markt.

## Affiliatepad

De feed-structuur is `https://referral.corendon.nl/c?c=38108&m=…&a=512226&r=&u=<encodedLanding>`. België: `referral.corendon.be`, `c=38103`, `a=511873`. Het campagne-`trackingURL` is dezelfde vorm met `m=0` en een lege `u`. De CTA is dat template plus de gecodeerde actiepagina, en gaat daarna door `promotionClickHref`.

Er is in deze correctie geen nieuwe aanroep van `/c`. End-to-end attributie van `m=0` is niet opnieuw getest.

## Beelden

Server-side opgehaald en opgeslagen onder `data/tradetracker-creatives/homepage-actions/`. De browser laadt `/aanbiedingen/creative-images/homepage/…`, niet de Corendon-CDN en niet `/i`.

| Bestand | Bron | Status | Last-Modified | sha256 |
| --- | --- | --- | --- | --- |
| `warme-winter-weken-780x320.png` | `https://images.corendonresources.com/NL/HPTO_WWW_NL_Toplaag_Header_780x320.png` | 200 image/png, 146596 bytes, geen Set-Cookie | Wed, 23 Sep 2026 09:30:51 GMT | `e046e431c1738f1cef582936604cbe0794f130616980f348150eb6ecca9d2bf5` |
| `last-minutes-oktober-november-780x320.png` | `https://images.corendonresources.com/NL/HPTO_LastMinute_NL_Toplaag_Header_780x320.png` | 200 image/png, 56434 bytes, geen Set-Cookie | Wed, 23 Sep 2026 14:57:38 GMT | `5880f83977df220b0d1532e5ba3a069c5149751e11ed9e31b4dc55b135d35f9f` |

Rechten voor HPTO buiten SOAP zijn in de docs niet formeel vastgelegd. Dat is een LEGAL/OWNER CHECK. De eigenaar wees deze URL’s aan voor de pagina.

Catalogus, `current.json` en live-price zijn niet aangeraakt.

## Wat niet terugkomt

- Materialen 2499691–2499698 en 2499700.
- “Vacances Last Minute” zonder bedrag.
- Kaching, inclusief news 322951 en 322932.
- Technische uitleg op de pagina.
