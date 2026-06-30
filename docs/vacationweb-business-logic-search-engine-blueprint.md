# VacationWeb Business Logic & Search Engine Blueprint

## 1. Doel van dit document

Dit document beschrijft de architectuur van de bedrijfslogica en zoekmotor achter VacationWeb. Het is geen UI-document en geen wireframe-document. Het beschrijft hoe data wordt verzameld, genormaliseerd, gecombineerd, gefilterd, gerangschikt en gepresenteerd in een objectieve vergelijkingservaring.

VacatoinWeb is een vergelijkingsplatform. De motor moet daarom:
- objectieve data verwerken;
- meerdere aanbieders samenbrengen;
- duidelijke filters en zoekintenties ondersteunen;
- resultaatlijsten consistent rangschikken;
- duplicaten herkennen;
- feeddata netjes integreren.

---

## 2. Hoofdarchitectuur van het platform

### 2.1 Kernprincipe
VacationWeb werkt met een centrale, universele representatie van een vakantieaanbieding. Alle feeds worden eerst omgezet naar dit universele model, waarna de rest van het platform hierop werkt.

### 2.2 Logische lagen
1. Feed layer
   - externe aanbiederfeeds
   - partnerfeeds
   - prijsfeeds
   - afbeeldingsfeeds

2. Normalisatie layer
   - mapping van feedvelden naar het universele model
   - standaardisatie van dataformaten

3. Matching layer
   - herkenning van dezelfde hotel- of aanbodinstantie
   - deduplicatie

4. Search & ranking layer
   - zoekopdrachten
   - filters
   - sortering
   - ranking

5. Presentation layer
   - resultatenpagina
   - hotelpagina
   - bestemmingspagina
   - themapagina

6. Affiliate layer
   - deeplinks
   - tracking
   - partnermapping

---

## 3. Hoe zoekopdrachten verwerkt worden

### 3.1 Zoekflow
Een zoekopdracht wordt verwerkt in de volgende stappen:
1. De gebruiker voert zoekcriteria in.
2. De criteria worden verzameld in een zoekrequestobject.
3. De zoekengine selecteert relevante aanbiedingen uit de index of database.
4. De zoekresultaten worden gefilterd op basis van de criteria.
5. De resultaten worden geordend op basis van rankingregels.
6. De resultaten worden teruggegeven aan de presentatie laag.

### 3.2 Zoekcriteria
De zoekopdracht kan bestaan uit:
- bestemming
- land
- regio
- vertrekperiode
- reisduur
- budget
- board type
- luchthaven
- sterren
- beoordeling
- reizigers
- accommodatie type
- flexibiliteit

### 3.3 Zoekmodellen
Er zijn twee belangrijke zoekgraden:
- exact/strakke filters voor concrete criteria
- brede intentiezoekopdrachten voor bestemmingen, thema’s en landen

### 3.4 Zoekresultatenbron
Resultaten komen uit een geaggregeerde dataset van aanbiedingen die zijn genormaliseerd en gededupliceerd.

### 3.5 Zoekstrategie
Voor VacationWeb is er een hybride aanpak nodig:
- structured search voor criteria zoals prijs, reisduur, board type, sterren, luchtvaart
- faceted search voor filters op de resultatenpagina
- keyword / content search voor SEO-landingspagina’s en bloginhoud

### 3.6 Huidige implementatie voor US-10
De eerste werkende Search API is nu geïmplementeerd als een `SearchService` die gebruikmaakt van de bestaande zoekindex uit US-09. De service ondersteunt zoeken op bestemming, hotelnaam, regio, land en aanbieder met gedeeltelijke matches, standaard alfabetische sortering en een gestandaardiseerd resultaatobject.

### 3.7 Huidige implementatie voor US-11
De eerste filterengine is nu geïmplementeerd als een `FilterEngine` die bovenop de bestaande index werkt. De engine ondersteunt filters op budget, reisduur, bestemming, land, verzorging en aanbieder, combineert meerdere filters tegelijk en retourneert een gestandaardiseerd resultaatobject.

---

## 4. Hoe filters gecombineerd worden

### 4.1 Filtertypes
Filters zijn in drie groepen te verdelen:
1. Mandatory filters
   - bestemming
   - reisduur
   - vertrekdatum
   - budget

2. Optional filters
   - board type
   - sterren
   - rating
   - luchthaven
   - aanbieder

3. Context filters
   - thema
   - land
   - regio
   - populaire route

### 4.2 Combinatieprincipe
Filters werken als een conjunctieve filterlaag:
- een result moet voldoen aan alle actieve filters
- een filter kan ook als OR werken binnen een veld, bijvoorbeeld meerdere board types

### 4.3 Filterlogica
Voorbeeld:
- bestemming = Mallorca
- budget = €500–€790
- duur = 7–12 nachten
- board type = All Inclusive
- sterren = 4 of hoger

Resultaten moeten voldoen aan alle actieve voorwaarden tegelijk.

### 4.4 Filterprioriteit
Filterprioriteit is als volgt:
1. locatie / bestemming
2. reisduur / vertrekperiode
3. budget
4. verzorging / board type
5. sterren / score
6. aanbieder / luchthaven

### 4.5 Toegestane filtermodi
- exact match
- range match
- multiple choice match
- boolean match
- fuzzy match voor naam of locatie

---

## 5. Hoe meerdere aanbieders worden samengevoegd

### 5.1 Aggregatieprincipe
Iedere aanbieder levert een set aanbiedingen. Deze worden eerst genormaliseerd en vervolgens samengevoegd in één universele aanboddataset.

### 5.2 Aggregatiestappen
1. ophalen van feeddata per aanbieder
2. normaliseren van velden
3. standaardiseren van waarden
4. matchen van hotels en aanbiedingen
5. deduplicatie van identieke aanbiedingen
6. indexeren in de centrale dataset

### 5.3 Aanbieders als aparte bronnen
Elke aanbieder blijft herkenbaar in het systeem via:
- aanbieder ID
- aanbieder naam
- partner status
- deeplink
- affiliate gegevens

### 5.4 Samengevoegde weergave
De gebruiker ziet één vergelijkingslijst, zelfs als meerdere aanbieders dezelfde hotel of vergelijkbare hotelruimte aanbieden.

### 5.5 Aanbieders kunnen hetzelfde hotel aanbieden op verschillende voorwaarden
Eenzelfde hotel kan meerdere aanbiedingen hebben vanuit verschillende bronnen, bijvoorbeeld:
- verschillende vertrekdata
- verschillende board types
- verschillende prijsniveaus
- verschillende aanbieders

Deze worden als aparte offers behandeld, tenzij ze feitelijk hetzelfde aanbod representeren.

---

## 6. Hoe identieke hotels van verschillende aanbieders herkend worden

### 6.1 Matchingstrategie
Identieke hotels moeten worden herkend op basis van meerdere signalen, niet op één veld.

### 6.2 Matching signaalset
- hotelnaam
- locatie / stad / regio / land
- star rating
- geo-coördinaten indien beschikbaar
- aanbieder-specifieke hotel ID
- chain of brand / hotel group
- room type of accommodation type
- image similarity mogelijk later

### 6.3 Matchniveaus
1. Exact match
   - dezelfde hotelnaam en locatie
2. Strong match
   - naam en regio gelijk, sterren gelijk
3. Probabilistic match
   - sterke overlap, maar niet volledig exact

### 6.4 Matching output
Resultaat van matching is een unieke hotel entity met meerdere offers onder hetzelfde hotel record.

### 6.5 Wanneer niet matchen
Als er teveel onzekerheid is, wordt een nieuw hotelrecord aangemaakt.

### 6.6 Conflictregels
- bij inconsistentie tussen velden, prioriteit naar geografische en naamgegevens
- wanneer verschillende hotels zeer sterk lijken maar niet exact zijn, geen automatische samenvoeging

---

## 7. Hoe prijsvergelijkingen werken

### 7.1 Prijsbasis
Prijsvergelijking gebeurt op basis van:
- totale prijs
- prijs per dag
- prijs per persoon of per kamer afhankelijk van model
- board type
- reisduur
- vertrekperiode

### 7.2 Prijsnormalisatie
Prijzen moeten worden genormaliseerd naar een gemeenschappelijke valuta en een consistent formaat.

### 7.3 Prijsvergelijkingsregels
- vergelijken op totale prijs is nodig voor de gebruiker
- vergelijken op prijs per dag is nodig voor waardebepaling
- prijs per dag moet worden berekend op een consistente basis

### 7.4 Toegestane vergelijkingtypes
- laagste totale prijs
- laagste prijs per dag
- hoogste waarde bij gegeven prijs
- vergelijking binnen dezelfde bestemming en reisduur

### 7.5 Prijscontext
Een prijs wordt nooit geïsoleerd gezien. De context is onderdeel van de vergelijking:
- hoeveel nachten
- hoeveel personen
- type kamer
- board type
- rating
- sterren

---

## 8. Hoe prijs per dag berekend wordt

### 8.1 Basisformule
Prijs per dag wordt berekend als:
- totale prijs / aantal verblijfdagen

### 8.2 Verblijfdagenberekening
Verblijfdagen zijn gebaseerd op:
- aantal nachten
- of het systeem een nacht en dag model gebruikt

### 8.3 Standaardregels
- indien er een totaalprijs is en aantal nachten bekend is, wordt prijs per dag berekend
- indien een totaalprijs ontbreekt, maar een dagprijs aanwezig is, kan deze worden gebruikt
- indien beide ontbreken, wordt de waarde als onbekend behandeld

### 8.4 Formule
$$
price	ext{ per day} = \frac{total\ price}{number\ of\ nights}
$$

### 8.5 Roundings
- prijs per dag wordt afgerond tot twee decimalen
- de opschone weergave kan worden afgerond op basis van presentatie-eisen

---

## 9. Welke sorteringen bestaan

### 9.1 Primaire sorteringen
1. Laagste prijs
2. Hoogste prijs
3. Laagste prijs per dag
4. Hoogste rating
5. Hoogste sterren
6. Meest relevant
7. Nieuwste beschikbaarheid
8. Beste waarde op basis van prijs/score ratio

### 9.2 Sortering per gebruiksscenario
- budgetgerichte gebruiker: laagste prijs of laagste prijs per dag
- kwaliteitsgerichte gebruiker: hoogste rating of sterren
- brede vergelijkingsgebruiker: meest relevant

### 9.3 Sortering in de interface
Sortering is een aparte laag van de resultatenlogica, niet de basisfilterlaag.

---

## 10. Hoe de ranking van resultaten gebeurt

### 10.1 Rankingprincipes
Ranking gebeurt na filtering. Het doel is niet om te “recommenderen”, maar om relevante resultaten logisch te ordenen.

### 10.2 Rankingfactoren
De ranking kan bestaan uit:
- prijsniveau binnen de zoekcontext
- prijs per dag
- sterren
- beoordeling
- reisduur
- board type match
- locatie match
- beschikbaarheid
- aanbieder status
- recentheid van data

### 10.3 Rankingmethode
Een rankingmodel kan als volgt werken:
- base score op basis van relevantie
- prijs score op basis van budgetcontext
- kwaliteit score op basis van review en sterren
- context score op basis van bestemming, board type en reisduur

### 10.4 Rankingregels
- resultaten die perfect passen op de zoekcriteria krijgen een hogere score
- logische prijscongruentie wordt gewaardeerd
- resultaten zonder relevante data krijgen een lagere score

### 10.5 Geen “beste keuze” claims
Ranking mag resultaten ordenen, maar mag geen expliciete aanbeveling formuleren.

---

## 11. Welke data verplicht is

### 11.1 Verplichte velden per offer
- offer ID
- hotel ID
- aanbieder ID
- aanbieder naam
- hotelnaam
- land
- regio
- bestemming
- prijs
- valuta
- reisduur in nachten
- vertrekperiode start
- vertrekperiode eind
- board type
- beschikbaarheidstatus
- deeplink
- bronfeed ID

### 11.2 Verplichte velden per hotel
- hotel ID
- hotelnaam
- land
- regio
- bestemming
- locatiegegevens indien beschikbaar
- sterren
- reviewscore indien beschikbaar

### 11.3 Verplichte velden per aanbieder
- aanbieder ID
- naam
- partner status
- affiliate status

---

## 12. Welke data optioneel is

### 12.1 Optionele velden per offer
- afbeelding URL
- description text
- room type
- room capacity
- facilities
- transfer info
- flexibele boekingsvoorwaarden
- voucher type
- discount percentage
- special tags

### 12.2 Optionele velden per hotel
- hotel description
- facilities
- latitude / longitude
- image gallery
- chain name
- address
- contact info

### 12.3 Optionele velden per aanbieder
- logo URL
- partner tier
- commission model
- region coverage

---

## 13. Hoe ontbrekende data behandeld wordt

### 13.1 Principes
Ontbrekende data mag niet leiden tot foutieve vergelijking. Het systeem moet expliciet omgaan met lege of onvolledige velden.

### 13.2 Behandelingsregels
- ontbrekende prijs: aanbod wordt gemarkeerd als onvolledig en niet meegenomen in prijsgerelateerde ranking
- ontbrekende reviewscore: score wordt als onbekend gemarkeerd
- ontbrekende sterren: score wordt als onbekend gemarkeerd
- ontbrekende locatie: match blijft beperkt tot naam matching
- ontbrekende afbeelding: fallback image wordt gebruikt

### 13.3 Data quality levels
Per aanbod wordt een data quality score bepaald op basis van:
- prijs aanwezig
- locatie aanwezig
- sterren aanwezig
- reviewscore aanwezig
- afbeelding aanwezig
- deeplink aanwezig

### 13.4 Fallback gedrag
Als data ontbreekt, wordt het aanbod niet verwijderd, maar gemarkeerd als incompleet.

---

## 14. Hoe feednormalisatie werkt

### 14.1 Doel
Feednormalisatie zet externe aanbiedersistische gegevens om naar een uniform model dat door het platform kan worden gebruikt.

### 14.2 Stappen in normalisatie
1. Brongegevens ophalen
2. Velden parseren
3. Waarden standaardiseren
4. Data types converteren
5. Vertalen naar universele velden
6. Validatie van verplichte velden
7. Toewijzing naar hotel, offer en aanbieder entiteiten

### 14.3 Normalisatieprincipes
- één uniforme naamgeving voor velden
- een uniforme valuta- en datumnotatie
- standaardisatie van board types en hotel categorieën
- mapping van verschillende terminologieën naar één vocabulary

### 14.4 Voorbeeld mapping
- “All Inclusive” / “AI” / “allinclusive” → “All Inclusive”
- “7 nights” / “7” → “nights: 7”
- “4*” / “4 stars” → “stars: 4”

### 14.5 Normalisatiekwaliteit
Elke feed krijgt een mapping score en een validatie status.

---

## 15. Hoe het universele TravelOffer model eruit ziet

### 15.1 Doel
Het universele TravelOffer model is de centrale representatie van een vakantieaanbieding in het platform.

### 15.2 Universele velden
- id
- sourceFeedId
- providerId
- providerName
- hotelId
- hotelName
- destinationId
- destinationName
- regionId
- regionName
- countryId
- countryName
- boardType
- nights
- departureWindowStart
- departureWindowEnd
- price
- currency
- pricePerDay
- stars
- rating
- reviewCount
- imageUrl
- deepLink
- availabilityStatus
- flexibilityScore
- valueScore
- dataQualityScore
- createdAt
- updatedAt

### 15.3 Semantische betekenis
Dit model moet voldoende rijk zijn om:
- zoeken
- filteren
- vergelijken
- sorteren
- ranken
- presenteren
- affiliate tracking mogelijk te maken

### 15.4 Modelregels
- elk offer moet tot één hotel behoren
- elk offer moet tot één provider behoren
- elk offer moet één bestemming en één land hebben
- elke prijs moet in een consistente valuta aanwezig zijn

---

## 16. Hoe Corendon, Sunweb, Prijsvrij en andere feeds later gekoppeld worden

### 16.1 Integratieprincipe
Elke externe aanbieder wordt eerst als aparte feedbron geïmplementeerd. Daarna wordt de data geaggregeerd in het universele model.

### 16.2 Integratieproces per aanbieder
1. feed endpoint of export analyseren
2. mapping schema opstellen
3. normalisatie regels vastleggen
4. partner metadata toevoegen
5. testdata importeren
6. matching en deduplicatie toepassen
7. indexeren in centrale dataset

### 16.3 Aanbieder-specifieke aandachtspunten
- Corendon: mogelijk sterke hotel- en reisproductdata
- Sunweb: mogelijk andere prijs- en beschikbaarheidslogica
- Prijsvrij: mogelijk andere room- en board-structuur
- overige partners: vergelijkbare mapping principes

### 16.4 Unified schema
Alle feeds worden gecodeerd volgens hetzelfde universele schema, ook als hun originele data anders is opgebouwd.

### 16.5 Partnerstatus
Elk feedrecord houdt status bij zoals:
- active
- inactive
- paused
- under review
- mapping issue

---

## 17. Hoe duplicate hotels worden afgehandeld

### 17.1 Doel
Duplicaten moeten niet leiden tot dubbel getoonde resultaten of verkeerde ranking.

### 17.2 Duplicate policies
Er zijn drie belangrijke policies:
1. Exact duplicate offer
   - dezelfde hotel + dezelfde aanbieder + dezelfde prijs + dezelfde reisduur + dezelfde vertrekperiode
   - markeer als duplicate en verwijder uit de actieve resultatenlijst

2. Duplicate hotel from another provider
   - hetzelfde hotel, andere aanbieder, vergelijkbare voorwaarden
   - combineer in één hotel entity, maar behoud individuele offers

3. Near duplicate hotel
   - bijna hetzelfde hotel, maar onzeker
   - markeer als candidate en laat handmatige review toe

### 17.3 Duplicate handling output
- actieve offers blijven beschikbaar
- duplicate offers worden gemarkeerd in de data laag
- hotel entity wordt geconsolideerd waar mogelijk

---

## 18. Hoe bestemmingen, regio’s en landen worden gemodelleerd

### 18.1 Hiërarchie
De data wordt gemodelleerd in een inhoudelijke hiërarchie:
- land
- regio
- bestemming
- hotel
- offer

### 18.2 Entiteitsrelaties
- een land bevat meerdere regio’s
- een regio bevat meerdere bestemmingen
- een bestemming bevat meerdere hotels
- een hotel heeft meerdere offers

### 18.3 Modelvelden
Land:
- id
- naam
- slug
- parent country of region if relevant

Regio:
- id
- naam
- slug
- parent country id

Bestemming:
- id
- naam
- slug
- parent region id
- parent country id

Hotel:
- id
- naam
- slug
- destination id
- region id
- country id

### 18.4 SEO implicaties
Deze hiërarchie ondersteunt:
- landpagina’s
- bestemmingspagina’s
- lokale contentpagina’s
- interne links

---

## 19. Hoe SEO-landingspagina’s gevoed worden

### 19.1 Doel
SEO-landingspagina’s moeten niet handmatig worden gevuld, maar worden gevoed vanuit de centrale data- en contentstructuur.

### 19.2 Bronnen voor landingpages
- bestemming data
- land data
- thema data
- offers data
- blog content
- FAQ data

### 19.3 Landingpage content modules
Elke landingpage krijgt modules zoals:
- intro over onderwerp
- relevante offers of hotels
- relevante thema’s
- relevante bestemmingen
- FAQ
- blogartikelen
- interne links

### 19.4 Dynamische contentregels
Een bestemmingspagina kan automatisch worden gevuld met:
- hotels in die bestemming
- relevante thema’s
- gerelateerde blogartikelen
- gerelateerde FAQ’s

### 19.5 SEO-eisen
Elke landingpage moet beschikken over:
- unieke title en meta description
- H1
- breadcrumb
- relevante interne links
- FAQ block
- content blocks met semantische structuur

---

## 20. Hoe prijsupdates verwerkt worden

### 20.1 Updatecycle
Prijsupdates moeten periodiek worden verwerkt, afhankelijk van feedfrequentie.

### 20.2 Updateproces
1. nieuwe feeddata arriveert
2. systeem vergelijkt met bestaande offerdata
3. prijs en beschikbaarheid worden bijgewerkt
4. data quality wordt opnieuw berekend
5. ranking en resultaten worden opnieuw opgebouwd indien nodig

### 20.3 Updategevallen
- prijs gewijzigd
- beschikbaarheid gewijzigd
- offer verwijderd
- offer toegevoegd
- hotel gegevens gewijzigd

### 20.4 Historie
Prijsupdates moeten traceerbaar zijn voor audit en debugging.

### 20.5 Performance
Prijsupdates moeten asynchroon en batchgewijs kunnen verlopen.

---

## 21. Hoe affiliate deeplinks opgeslagen worden

### 21.1 Doel
Iedere aanbieding moet een traceerbare en betrouwbare deeplink naar de aanbieder hebben.

### 21.2 Deeplink velden
- link URL
- affiliate parameter set
- partner ID
- tracking token
- click ID support
- status
- last validated timestamp

### 21.3 Validatie
De deeplink wordt regelmatig gevalideerd om te voorkomen dat links kapot zijn of verlopen.

### 21.4 Security en traceability
- geen verplichte directe boeking op VacationWeb zelf
- link wordt alleen als outbound action gebruikt
- tracking moet transparant zijn

---

## 22. Welke database-entiteiten uiteindelijk nodig zijn

### 22.1 Core entities
1. Provider
2. Feed
3. Hotel
4. Offer
5. Destination
6. Region
7. Country
8. SearchQuery
9. SearchResultCache
10. AffiliateLink
11. PriceUpdateEvent
12. DataQualityIssue
13. DuplicateMatch
14. FAQEntry
15. BlogPost
16. SEOPage

### 22.2 Relaties tussen entities
- Provider has many Feeds
- Feed has many Offers
- Hotel has many Offers
- Offer belongs to one Hotel and one Provider
- Destination belongs to one Region and one Country
- SEOPage can reference Destination, Country, Theme, Offer or BlogPost

### 22.3 Waarom deze entiteiten nodig zijn
Ze ondersteunen de volledige business flow van:
- aggregatie
- matching
- vergelijken
- SEO-landingspagina’s
- affiliate tracking
- prijsupdates
- content

---

## 23. Business rules voor betrouwbaarheid

### 23.1 Transparantie
De gebruiker moet zien wat er wordt vergeleken.

### 23.2 Objectiviteit
Ranking en sortering mogen niet worden gebruikt om een verborgen aanbeveling te doen.

### 23.3 Consistentie
Alle feeds moeten naar hetzelfde model worden geconverteerd.

### 23.4 Traceability
Elke aanbieding moet herleidbaar zijn tot bron, aanbieder en link.

### 23.5 Flexibility
Het systeem moet later eenvoudig uitbreidbaar zijn met nieuwe aanbieders.

---

## 24. Conclusie

Deze blueprint beschrijft de motor achter VacationWeb: van het verzamelen van feeddata tot het bouwen van een objectieve, schaalbare vergelijkingsengine.

De kern is een universeel aanbodmodel, een robuuste normalisatie- en matchinglaag, een duidelijke zoek- en filterlaag, een rankinglaag zonder adviseurlogica, en een affiliate- en SEO-architectuur die later eenvoudig kan worden uitgebreid met nieuwe feeds zoals Corendon, Sunweb, Prijsvrij en andere partners.
