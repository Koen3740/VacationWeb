# Aanbiedingen V2 — Corendon-homepageacties, 2026-10-05

## Wat de pagina toont

Twee acties, per markt, omdat ze op de live Corendon-site staan en een bestaande VacationWeb-klik daarop landt.

| Actie | Bedrag | Publieke pagina | Beeld op de homepage |
| --- | --- | --- | --- |
| Warme Winter Weken | tot €600 extra korting | `https://www.corendon.nl/winterzon` en `https://www.corendon.be/winterzon` | `HPTO_WWW_*_Topbanner_1168x500.jpg` |
| Last minutes oktober en november | tot €200 extra korting | `https://www.corendon.nl/topdeals` en `https://www.corendon.be/topdeals` | `HPTO_LastMinute_NL_Topbanner_1168x500.jpg` |

De zinnen op die pagina’s, opgehaald op 2026-10-05:

- NL winterzon: “Tijdens de Warme Winter Weken profiteer je van tot € 600 extra korting per boeking naar populaire winterzonbestemmingen zoals Egypte en de Canarische Eilanden.”
- BE winterzon: “tot €600 extra korting per boeking naar populaire winterzonbestemmingen zoals Curaçao, Bonaire, Kaapverdië, Gambia, Turkije, Spanje en Egypte.”
- NL en BE topdeals, paginatitel “Last Minutes oktober en november”: “Last minute naar de zon in oktober of november? Boek nu een van onze scherpe Last Minute Deals en profiteer van tot € 200 Last Minute Korting.”

Kidskorting en vertrekdata uit de filters staan niet op VacationWeb. De bestemmingen blijven per markt, omdat NL en BE daar verschillen.

## Affiliatepad

HEAD, zonder de redirect te volgen, op 2026-10-05:

`https://referral.corendon.{nl|be}/c?c=38108|38103&m=0&a=512226|511873&r=&u=<actiepagina>`

geeft 302 naar die actiepagina met `utm_source=tradetracker`, `utm_medium=affiliate`, `utm_id` de campagne, en `utm_content=Vacationweb.nl`. Een lege `u` landt op de campagne-homepage, niet op de actie. Daarom gebruikt de CTA de deeplink. `m=0` is het campagneniveau, niet een van de Banner*-materialen.

## Beelden

De homepage-HTML verwijst naar de 1168×500-topbanners, niet naar de 780×320-toplaag. Die toplaagbestanden bestaan wel en tonen dezelfde actietekst (bekeken 2026-10-05). De pagina gebruikt de bestanden die de homepage nu echt toont.

Opgeslagen eigen kopieën, sha256:

- `warme-winter-weken-1168x500.jpg` — `c2391accffd610af7e60c400dc2055da23a19c6b1a9bd3fd6a5a38efae5ad648` — bron `https://images.corendonresources.com/NL/HPTO_WWW_NL_Topbanner_1168x500.jpg`, last-modified Wed, 23 Sep 2026 09:30:50 GMT. Het BE-bestand `HPTO_WWW_BENL_Topbanner_1168x500.jpg` is bytegelijk.
- `last-minutes-oktober-november-1168x500.jpg` — `dd3eecc2b0acec221d6e0e36b3eed882b18227fc08932511c5f5c5774efc6577` — bron `https://images.corendonresources.com/NL/HPTO_LastMinute_NL_Topbanner_1168x500.jpg`, last-modified Wed, 23 Sep 2026 14:57:39 GMT. De BE-homepage gebruikt ditzelfde NL-bestand.

De 780×320-toplaag, ter controle, niet als paginabeeld:

- `HPTO_WWW_NL_Toplaag_Header_780x320.png` — 200 image/png, “TOT €600 EXTRA KORTING”
- `HPTO_LastMinute_NL_Toplaag_Header_780x320.png` — 200 image/png, “TOT €200 EXTRA KORTING”

Serven via `/aanbiedingen/creative-images/homepage/…` uit `data/tradetracker-creatives/homepage-actions/`. Geen catalogus, geen `current.json`, geen live-price.

## Wat niet terugkomt

- Materialen 2499691–2499698 en 2499700.
- “Vacances Last Minute” zonder bedrag.
- Kaching, inclusief news 322951 en 322932.
- Technische uitleg op de pagina.
