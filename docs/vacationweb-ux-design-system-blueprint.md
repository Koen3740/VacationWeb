# VacationWeb UX & Design System Blueprint

## 1. Designfilosofie

### 1.1 Wat VacationWeb moet voelen
VacationWeb moet aanvoelen als een volwassen, commercieel sterke en betrouwbare vergelijkingssite voor vakanties. De ervaring moet professioneel, helder, snel te scannen en overtuigend zijn zonder ooit te adviseren of te verkopen.

### 1.2 Emotie die bezoekers moeten ervaren
- vertrouwen
- controle
- duidelijkheid
- rust
- efficiëntie
- commercieel gezag

### 1.3 Waarom bezoekers vertrouwen krijgen
- heldere en objectieve informatie
- consistente structuur op elke pagina
- transparante prijs- en dataweergave
- duidelijke scheiding tussen vergelijking en boeking
- volwassen, niet amateuristische presentatie

### 1.4 Waarom bezoekers langer blijven
- sterke navigatie tussen zoek, resultaten, bestemmingen en thema’s
- duidelijke inhoudsblokken die nieuwsgierigheid opwekken
- snelle filtermogelijkheden
- relevante vervolgstappen op elke pagina
- een structuur die logisch en voorspelbaar voelt

### 1.5 Productgedrag en tone of voice
VacationWeb is een vergelijker. De tone of voice moet:
- zakelijk
- betrouwbaar
- neutraal
- professioneel
- helder
- informatief

Verboden taal en gedrag:
- “beste keuze”
- “aanbevolen”
- “ons advies”
- “wij raden aan”
- “dit is de slimste optie”

Toegestaan:
- “vergelijkbare opties”
- “prijs per dag”
- “beoordeling”
- “verzorging”
- “reisduur”
- “aanbieder”

---

## 2. Layoutsysteem

### 2.1 Algemeen principe
Het layoutsysteem moet een volwassen commercieel webbeeld bieden met sterke hiërarchie, veel ruimte en duidelijke contentzones. Het moet zowel scannable zijn als diepgang bieden.

### 2.2 Desktop
- maximale breedte: breed, maar consistent begrensd
- contentcontainer: gecentreerd, maximaal 1200–1440 px
- grid: 12 kolommen
- hoofdcontentgebied: 8 kolommen
- sidebar: 4 kolommen
- grote witruimtes tussen secties
- duidelijke verticale rhythme

### 2.3 Tablet
- max breedte: medium
- grid: 8 kolommen
- sidebar kan verschuiven naar boven of onder content
- secties blijven duidelijk gescheiden
- componenten worden compact, maar niet overvol

### 2.4 Mobile
- grid: 4 kolommen
- gestapelde secties
- compacte maar duidelijke inhoudshierarchie
- filters worden samengevouwen
- zoekmodule wordt stapelbaar en direct zichtbaar
- grote touch targets
- voldoende witruimte tussen blokken

### 2.5 Layout principes
- consistente marges en paddings
- secties met duidelijke tussenruimtes
- geen overvolle pagina’s
- inhoud wordt in blokken georganiseerd
- hero, zoekmodule, content en CTA’s hebben duidelijke visuele prioriteit

### 2.6 Spacing systeem
- kleine spacing: 8 px
- medium spacing: 16 px
- large spacing: 24 px
- extra large spacing: 40–64 px
- sectieafstand: 72–120 px

### 2.7 Containers
- content containers zijn gecentreerd
- sections hebben een duidelijke boven- en ondermarge
- cards hebben eigen interne ruimte en consistente radius

---

## 3. Header systeem

### 3.1 Header doel
De header moet direct navigatie bieden, vertrouwen uitstralen en een sterke bron van interne links zijn.

### 3.2 Desktop header
Inhoud:
- logo linksboven
- hoofdnavigatie rechts of in het midden
- zoekicon of directe zoekcta
- CTA naar zoekpagina

Structuur:
- vaste header met subtiele achtergrond
- logo zichtbaar en sterk aanwezig
- menu-items duidelijk en herkenbaar
- hover states voor submenu’s
- ruimte voor mega menu

### 3.3 Mobile header
Inhoud:
- logo
- zoekknop
- hamburgermenu

Gedrag:
- menu opent als slide-over of drawer
- submenu’s worden verticaal uitgeklapt
- zoekfunctie blijft direct beschikbaar

### 3.4 Sticky gedrag
- header blijft zichtbaar tijdens scrollen
- op scroll wordt de header subtiel compacter of donkerder
- zoek en menu blijven makkelijk toegankelijk

### 3.5 Zoekfunctie in header
- compacte zoektrigger
- optional direct openen op desktop als overlay of inline panel
- mobiele versie heeft directe zoekactie

### 3.6 Mega menu
Het mega menu is een belangrijk commercieel navigatieelement zonder dat het te zwaar wordt.

Categorieën:
- bestemmingen
- landen
- thema’s
- blog
- FAQ

Gedrag:
- wordt geopend op hover of click
- bevat meerdere kolommen
- toont populaire links per categorie
- toont links naar belangrijke landingpages en categoriepagina’s

---

## 4. Mega Menu

### 4.1 Doel
Het mega menu moet bezoekers helpen om snel verder te navigeren naar inhoud die relevant is voor hun vakantie-intentie.

### 4.2 Structuur
Het mega menu bevat vijf hoofdsecties:
1. Bestemmingen
2. Landen
3. Thema’s
4. Blog
5. FAQ

### 4.3 Bestemmingen-kolom
Inhoud:
- populaire bestemmingen
- korte labels of beschrijvingen
- links naar bestemmingspagina’s

Voorbeeld:
- Mallorca
- Costa del Sol
- Antalya
- Kreta
- Algarve

### 4.4 Landen-kolom
Inhoud:
- landen met vakantiecontext
- links naar landpagina’s

Voorbeeld:
- Spanje
- Turkije
- Griekenland
- Portugal
- Egypte

### 4.5 Thema’s-kolom
Inhoud:
- thema-intenties
- links naar themapagina’s

Voorbeeld:
- All inclusive
- Strand
- Familie
- Last minute
- Goedkoop
- Luxe

### 4.6 Blog-kolom
Inhoud:
- recent bekeken of populaire blogartikelen
- categorieën zoals budget, bestemmingen, reisduur, prijsvergelijking

### 4.7 FAQ-kolom
Inhoud:
- onderwerpen zoals prijs per dag, aanbieder, filteren, boekingstraject

### 4.8 UX-gedrag
- duidelijke hover states
- snelle scanbaarheid
- niet te veel items per categorie
- links hebben korte labels en duidelijke context

---

## 5. Homepage ontwerp

### 5.1 Homepage-doel
De homepage moet drie dingen doen:
1. uitleggen wat VacationWeb is
2. bezoekers helpen zoeken
3. bezoekers leiden naar relevante interne inhoudspaden

### 5.2 Sectie 1: Hero
Doel:
- directe zoekintentie opwekken

Inhoud:
- sterke headline
- korte introductie over objectief vergelijken
- zoekmodule
- secundaire links naar resultaten of thema’s

Componenten:
- tekstblok
- zoekmodule
- CTA’s

Positie:
- bovenaan, volledig zichtbaar

Prioriteit:
- hoogste

UX-reden:
- bezoekers moeten direct kunnen beginnen met zoeken

### 5.3 Sectie 2: Trust bar
Doel:
- geloofwaardigheid en schaal laten zien

Inhoud:
- aantallen en statussen zoals vergelijkbare aanbiedingen, partners, objectieve data
- korte vertrouwensteksten

Componenten:
- cards of stat blocks

Positie:
- direct onder hero

Prioriteit:
- hoog

UX-reden:
- bezoekers moeten snel zien dat het platform serieus en groot genoeg is

### 5.4 Sectie 3: Populaire bestemmingen
Doel:
- bezoekers leiden naar specifieke vakantiebestemmingen

Inhoud:
- cards met bestemming, korte intro en CTA

Componenten:
- cards met afbeelding, titel, beschrijving, link

Positie:
- na trust block

Prioriteit:
- hoog

UX-reden:
- dit is een belangrijke kompasfunctie voor gebruikers zonder precieze bestemming

### 5.5 Sectie 4: Populaire landen
Doel:
- landgerichte navigatie ondersteunen

Inhoud:
- landcards met korte introductie

Componenten:
- cards

Positie:
- na bestemmingen

Prioriteit:
- medium

UX-reden:
- helpt bij bredere vakantie-intenties

### 5.6 Sectie 5: Thema’s
Doel:
- bezoekers met voorkeuren begeleiden

Inhoud:
- thema cards zoals all inclusive, strand, familie, last minute, goedkoop

Componenten:
- cards

Positie:
- na landen

Prioriteit:
- medium-high

UX-reden:
- veel bezoekers weten niet exact waarheen, maar wel wat ze willen

### 5.7 Sectie 6: Trending vakanties
Doel:
- actuele vergelijkbare opties tonen

Inhoud:
- hotelcards of aanbodcards
- prijs, prijs per dag, bestemming, verzorging, rating, aanbieder

Componenten:
- card grid

Positie:
- midden van de homepage

Prioriteit:
- hoog

UX-reden:
- laat direct zien dat het platform live en commercieel gevuld is

### 5.8 Sectie 7: Goedkoopste deals
Doel:
- budgetgerichte bezoekers aantrekken

Inhoud:
- cards met scherp geprijsde opties
- duidelijk prijs en prijs per dag

Componenten:
- lijst of cards

Positie:
- na trending vakanties

Prioriteit:
- medium-high

UX-reden:
- een grote groep bezoekers komt met budget in gedachten

### 5.9 Sectie 8: Last minutes
Doel:
- flexibele en korte termijn trippen ondersteunen

Inhoud:
- korte termijn opties met vertrekperiode en prijs

Componenten:
- cards of module

Positie:
- na goedkope deals

Prioriteit:
- medium

UX-reden:
- laat een belangrijk gebruiksscenario zien

### 5.10 Sectie 9: Blog blok
Doel:
- expertise en vertrouwen uitbreiden

Inhoud:
- korte introductie, 3–5 artikelcards

Componenten:
- cards with metadata

Positie:
- later in de homepage

Prioriteit:
- medium

UX-reden:
- ondersteunt SEO en neemt bezoekers mee naar content

### 5.11 Sectie 10: FAQ blok
Doel:
- veelgestelde vragen beantwoorden

Inhoud:
- korte vragen/antwoorden
- links naar volledige FAQ-secties

Componenten:
- accordion of cards

Positie:
- voor footer

Prioriteit:
- medium

UX-reden:
- helpt twijfelende bezoekers en versterkt vertrouwen

### 5.12 Sectie 11: Footer
Doel:
- complete navigatie en legal structuur bieden

Inhoud:
- categorieën, bestemmingen, landen, thema’s, blog, FAQ, legal

Componenten:
- meerdere kolommen

Positie:
- einde van de homepage

Prioriteit:
- medium

UX-reden:
- crawlbaarheid, navigatie en vertrouwen

---

## 6. Zoekmodule

### 6.1 Belang
De zoekmodule is het belangrijkste onderdeel van VacationWeb. Het moet direct bruikbaar, goed te begrijpen en commercieel sterk zijn.

### 6.2 Algemene UX-principes
- snel invullen
- weinig cognitieve belasting
- duidelijke labels
- logisch stapelen van velden
- standaard waarden moeten nuttig zijn
- resultaten moeten direct relevant zijn

### 6.3 Zichtbare velden op desktop
- bestemming
- vertrekperiode
- reisduur
- budget
- verzorging
- luchthaven
- sterren
- reizigers

### 6.4 Standaard verborgen velden
- meer geavanceerde filters kunnen standaard verborgen zijn
- pas zichtbaar na expand of in de resultatenpagina

### 6.5 Desktop gedrag
- zoekmodule verschijnt als een prominent blok in de hero
- velden staan in een duidelijke rij of twee rijen
- runtime-ervaring is snel en responsief
- de CTA is prominent en direct zichtbaar

### 6.6 Mobiel gedrag
- velden worden stapelbaar weergegeven
- de zoekmodule is compact maar volledig functioneel
- gebruikers kunnen scrollen zonder het overzicht te verliezen
- autofocus op eerste relevant veld

### 6.7 UX-flow
1. Gebruiker kiest bestemming
2. Gebruiker kiest vertrekperiode
3. Gebruiker kiest reisduur
4. Gebruiker kiest budget
5. Gebruiker kiest verzorging
6. Gebruiker kiest luchthaven of laat leeg
7. Gebruiker kiest sterren of laat leeg
8. Gebruiker kiest aantal reizigers
9. Gebruiker klikt op zoek
10. Gebruiker landt op resultatenpagina met gefilterde opties

### 6.8 Interactieprincipes
- velden moeten logisch gegroepeerd zijn
- prijs- en reisduurfilters moeten snel begrijpelijk zijn
- de zoekmodule moet nooit te “form-achtig” aanvoelen
- er moet een duidelijke zoekstatus zijn

---

## 7. Resultatenpagina

### 7.1 Doel
De resultatenpagina moet de gebruiker laten zien welke vakanties er zijn, hoeveel er zijn en hoe ze zich verhouden op basis van objectieve vergelijkingsgegevens.

### 7.2 Pagina-opbouw

#### Bovenaan
- breadcrumb
- titel
- introtekst
- aantal resultaten
- sortering

#### Linkerzijde
- filters
- geavanceerde filtersecties
- reset optie

#### Midden
- lijst met hotel/aanbiedingcards

#### Tussen resultaten
- inhoudsblok over bestemming of thema
- FAQ
- vergelijkbare bestemmingen

#### Onderaan
- paginering
- extra contentblok
- FAQ
- gerelateerde bestemmingen

### 7.3 Filters
Inhoud:
- budget
- reisduur
- vertrekperiode
- verzorging
- sterren
- beoordeling
- luchthaven
- aanbieder
- sortering

Gedrag:
- filters zijn snel zichtbaar
- actieve filters zijn duidelijk zichtbaar
- gebruikers kunnen filters eenvoudig resetten

### 7.4 Sortering
Opties:
- laagste prijs
- hoogste prijs
- prijs per dag
- sterren
- beoordeling
- meest relevant

### 7.5 Hotelkaart op resultatenpagina
Elke kaart moet objectieve informatie tonen:
- hotelnaam
- afbeelding
- bestemming
- aanbieder
- sterren
- beoordeling
- verzorging
- reisduur
- totale prijs
- prijs per dag
- CTA naar detailpagina

### 7.6 Contentblokken tussen resultaten
- korte intro over de bestemming of het thema
- links naar relevante inhoud
- FAQ over de zoekintentie

### 7.7 UX-principes voor resultatenpagina
- snelle scanbaarheid
- weinig afleiding
- duidelijke informatieprioriteit
- objectieve data boven marketingtekst

---

## 8. Hotelkaart ontwerp

### 8.1 Doel
De hotelkaart moet binnen een oogopslag duidelijk maken wat de aanbieding inhoudt en of deze relevant is.

### 8.2 Zichtbare elementen
1. Afbeelding
2. Hotelnaam
3. Bestemming / regio
4. Aanbieder
5. Sterren
6. Beoordeling
7. Verzorging
8. Reisduur
9. Totale prijs
10. Prijs per dag
11. CTA

### 8.3 Volgorde van zichtbaarheid
- eerste oogopslag: afbeelding, naam, prijs, prijs per dag
- tweede oogopslag: sterren, beoordeling, verzorging, aanbieder
- derde oogopslag: reisduur en locatie

### 8.4 Prioriteit
- prijs en prijs per dag zijn prioriteit 1
- hotelnaam en locatie zijn prioriteit 2
- sterren, beoordeling en verzorging zijn prioriteit 3
- aanbieder is prioriteit 4

### 8.5 Wat moet niet opvallen
- irrelevante marketingtekst
- overmatige badges
- te veel callouts

### 8.6 UX-reden
De kaart moet functioneel en professioneel zijn, niet decoratief.

---

## 9. Hoteldetailpagina

### 9.1 Doel
De hoteldetailpagina moet alle relevante details tonen die nodig zijn om een bewuste keuze te maken, zonder dat VacationWeb zich als adviseur of verkoper opstelt.

### 9.2 Hero sectie
Inhoud:
- galerij of grote afbeelding
- hotelnaam
- locatie
- aanbieder
- prijsblok
- primaire CTA naar aanbieder

### 9.3 Hotelinformatie blok
Inhoud:
- hoteltype
- sterren
- beoordeling
- locatie
- bestemming
- reisduur
- verzorging
- vertrekperiode

### 9.4 Faciliteiten blok
Inhoud:
- zwembad
- strandafstand
- wifi
- parking
- all inclusive
- familiegeschikt
- fitness
- spa

### 9.5 Kaart blok
Inhoud:
- locatie op kaart
- afstand tot strand of centrum

### 9.6 Prijsinformatie blok
Inhoud:
- totale prijs
- prijs per dag
- reisduur
- vertrekperiode
- board type
- voorwaarden

### 9.7 Vergelijkbare hotels
Inhoud:
- soortgelijke hotels in dezelfde regio
- vergelijkbare prijsniveaus
- vergelijkbare reisduur

### 9.8 Bestemming content blok
Inhoud:
- korte beschrijving van de bestemming
- relevante links naar land- en bestemmingspagina

### 9.9 FAQ blok
Inhoud:
- vragen over prijs, aanbieder, locatie, beschikbaarheid en faciliteiten

### 9.10 CTA blok
Inhoud:
- primaire CTA naar aanbieder
- secundaire link naar vergelijkbare opties

### 9.11 UX-principes
- geen advieszinnen
- geen aanbevelingsclaims
- alleen objectieve informatie
- duidelijke scheiding tussen vergelijking en boeking

---

## 10. Bestemmingspagina

### 10.1 Voorbeeldroute
- /spanje/mallorca

### 10.2 Doel
Bezoekers moeten een volledig maar compact overzicht krijgen van de bestemming, de relevante vakantiecontext en de beschikbare opties.

### 10.3 Pagina-structuur
1. Hero
2. Intro over de bestemming
3. Beste reistijd
4. Prijsinformatie
5. Populaire hotels / aanbiedingen
6. Populaire regio’s
7. Thema’s die passen bij de bestemming
8. FAQ
9. Blogartikelen
10. CTA naar resultatenpagina

### 10.4 Inhoud per sectie
- hero met titel en CTA
- korte introductie over regio en vakantievorm
- prijsniveaus en reisperiode
- cards met populaire hotels of aanbiedingen
- subregio’s of nabije gebieden
- thema’s die relevant zijn
- FAQ en blogartikelen

---

## 11. Landpagina

### 11.1 Voorbeeldroute
- /spanje

### 11.2 Doel
Bezoekers moeten op landniveau snel begrijpen welke regio’s, bestemmingen en thema’s relevant zijn.

### 11.3 Pagina-structuur
1. Hero
2. Intro over het land
3. Regio’s / eilanden / kustgebieden
4. Populaire bestemmingen
5. Thema’s per land
6. Hotels of aanbiedingen
7. FAQ
8. Blogartikelen
9. CTA naar zoekpagina

### 11.4 Inhoud per sectie
- introductie van het land als vakantiebestemming
- kaarten of links naar regio’s en bestemmingen
- thema’s zoals strand, all inclusive, familie, last minute
- relevante hotels of aanbiedingen
- FAQ en blogcontent

---

## 12. Themapagina

### 12.1 Voorbeeldroute
- /all-inclusive

### 12.2 Doel
Bezoekers met een voorkeur maar zonder exacte bestemming moeten snel kunnen navigeren naar relevante opties.

### 12.3 Pagina-structuur
1. Hero
2. Uitleg over het thema
3. Populaire landen
4. Populaire bestemmingen
5. Aanbiedingen / hotels
6. FAQ
7. Blogartikelen
8. CTA naar resultatenpagina

### 12.4 Inhoud per sectie
- duidelijke uitleg van het thema
- links naar landen en bestemmingen die relevant zijn
- cards met vergelijkbare aanbiedingen
- FAQ en blogartikelen

---

## 13. Componentbibliotheek

### 13.1 Buttons
Doel:
- acties en navigatie ondersteunen

Varianten:
- primary
- secondary
- ghost
- text link

Gedrag:
- duidelijke hover en focus state
- voldoende contrast
- consistente spacing

### 13.2 Cards
Doel:
- content en aanbiedingen structureren

Varianten:
- destination card
- hotel card
- article card
- theme card
- faq card

Gedrag:
- consistente image area
- duidelijke titel en metadata
- CTA zichtbaar maar niet dominant

### 13.3 Accordions
Doel:
- FAQ’s en compacte content organiseren

Gedrag:
- één item open tegelijk of meerdere items openbaar
- duidelijke expand/collapse state

### 13.4 Filters
Doel:
- snelle selectie van zoekcriteria

Varianten:
- checkbox list
- range filter
- dropdown filter
- chip filter

Gedrag:
- actieve filters zichtbaar
- reset optie aanwezig

### 13.5 Badges
Doel:
- status of metadata benadrukken

Voorbeelden:
- prijsniveau
- thema
- aanbieder
- flexibiliteit

### 13.6 Tabs
Doel:
- inhoud categoriseren

Voorbeelden:
- blog categorieën
- FAQ categorieën
- prijs- en faciliteitenweergave

### 13.7 Sliders
Doel:
- prijs of duurfiltering

Gedrag:
- duidelijke labels
- live feedback

### 13.8 Dropdowns
Doel:
- compacte selectie van opties

Gedrag:
- duidelijke label
- snel herkenbaar

### 13.9 Breadcrumbs
Doel:
- context en navigatie geven

Gedrag:
- zichtbaar op resultaten- en detailpagina’s
- links naar vorige niveaus

---

## 14. Visuele Richtlijnen

### 14.1 Moderne uitstraling
- professionele en volwassen visuele taal
- rustige maar duidelijke structuur
- voldoende witruimte
- sterke inhoudshiërarchie

### 14.2 Premium gevoel
- verzorgd beeldgebruik
- consistente componentstijl
- duidelijke typografie
- nette spacing
- hoogwaardige, niet drukke presentatie

### 14.3 Vertrouwen
- nette en consistente informatieweergave
- geen overmatige marketingtaal
- heldere labels en structuur
- professionele micro-interacties

### 14.4 Rust
- niet te veel kleuren
- duidelijke focus op data en content
- balans tussen informatie en lucht

### 14.5 Scanbaarheid
- korte blokken
- duidelijke koppen
- grote aandacht voor informatieprioriteit
- filters en cards moeten direct begrijpelijk zijn

### 14.6 Geen exacte kleuren of CSS
Deze blueprint geeft richtlijnen, geen implementatie-specifieke styling.

---

## 15. SEO Integratie

### 15.1 Homepage
Contentblokken:
- hero with zoekintentie
- bestemmingscards
- landcards
- themacards
- blog highlights
- FAQ preview

Interne links:
- naar bestemmings-, land-, thema- en blogpagina’s

Breadcrumbs:
- niet nodig op homepage

Indexeerbaarheid:
- primaire SEO-pagina voor brede zoekintenties

### 15.2 Zoekpagina
Contentblokken:
- intro over waarom zoeken werkt
- contextuele links naar populaire bestemmingen en thema’s

Interne links:
- naar populaire resultatenpagina’s

Breadcrumbs:
- optioneel

Indexeerbaarheid:
- belangrijk voor brede zoektermen

### 15.3 Resultatenpagina
Contentblokken:
- intro over bestemming of thema
- FAQ over zoekintentie
- gerelateerde bestemmingen

Interne links:
- naar hotelpagina’s en bestemmingspagina’s

Breadcrumbs:
- verplicht

Indexeerbaarheid:
- zeer belangrijk

### 15.4 Hotelpagina
Contentblokken:
- beschrijving van hotel en bestemming
- FAQ
- vergelijkbare hotels

Interne links:
- naar bestemming, land, thema en vergelijkbare hotels

Breadcrumbs:
- verplicht

Indexeerbaarheid:
- zeer belangrijk

### 15.5 Bestemmingspagina
Contentblokken:
- intro over bestemming
- prijsinformatie
- thema’s
- FAQ
- blogartikelen

Interne links:
- naar landpagina, thema’s, hotels en blogartikelen

Breadcrumbs:
- verplicht

Indexeerbaarheid:
- zeer belangrijk

### 15.6 Landpagina
Contentblokken:
- intro over het land
- regio’s en bestemmingen
- thema’s
- FAQ
- blogartikelen

Interne links:
- naar bestemmingspagina’s, thema’s en blogcontent

Breadcrumbs:
- verplicht

Indexeerbaarheid:
- belangrijk

### 15.7 Themapagina
Contentblokken:
- uitleg over thema
- relevante landen en bestemmingen
- aanbiedingen
- FAQ
- blogartikelen

Interne links:
- naar bestemmings- en landpagina’s

Breadcrumbs:
- verplicht

Indexeerbaarheid:
- belangrijk

---

## 16. Mobile First Strategie

### 16.1 Principe
VacationWeb moet mobiel niet als een verkleinde desktopversie worden ontworpen. Mobiel moet bewust worden ontworpen als een eigen ervaring.

### 16.2 Mobiele prioriteiten
1. snelle zoekactie
2. duidelijke zoekresultaten
3. snelle navigatie naar bestemmingen en thema’s
4. duidelijke filters
5. eenvoudige vervolgstappen

### 16.3 Mobiel ontwerpprincipe
- zoekmodule direct toegankelijk
- resultatenpagina prioriteit voor inhoud en filters
- menu is compact en snel
- cards zijn gestapeld en gemakkelijk te scannen
- grote touch targets
- minder tekst per blok, maar meer duidelijke structuur

### 16.4 Mobiel UX-flow
- gebruiker landt op homepage
- ziet direct zoekmodule of snelle navigatie
- kan direct zoeken of naar populaire categorieën gaan
- resultatenpagina toont prioriteit aan lijst en filters
- detailpagina toont prijs en CTA direct bovenaan

### 16.5 Waarom mobile first essentieel is
Veel vakantiezoekopdrachten gebeuren op mobiel. De ervaring moet daarom snel, begrijpelijk en doelgericht zijn.

---

## 17. Conclusie

VacationWeb moet worden ontworpen als een volwassen, commercieel sterke en inhoudsrijke vergelijkingssite. De UX moet vertrouwen, controle en snelle navigatie bieden. Elke pagina moet zijn eigen rol vervullen in een groter systeem van zoeken, vergelijken, content en interne navigatie.

Deze blueprint is bedoeld als het fundament voor een volgende ontwikkelfase. Het beschrijft niet alleen wat er moet komen, maar ook hoe het moet voelen, hoe het moet werken en hoe het moet bijdragen aan een volwassen platformervaring.
