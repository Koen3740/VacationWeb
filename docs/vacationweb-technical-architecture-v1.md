# VacationWeb Technical Architecture v1

## 1. Doel van deze architectuur

Deze architectuur beschrijft een technische basis voor een schaalbaar vakantievergelijkingsplatform dat:
- begint met één feed (Corendon);
- later uit kan groeien naar tientallen aanbieders;
- honderdduizenden aanbiedingen kan verwerken;
- snel en betrouwbaar kan zoeken, filteren, ranken en renderen;
- SEO-vriendelijk is;
- eenvoudig kan schalen in productie.

De architectuur is ontworpen als een toekomstbestendige basis, niet als een eenvoudige MVP-oplossing.

---

## 2. Architectuurprincipes

### 2.1 Scheiding van verantwoordelijkheden
Het systeem wordt opgesplitst in duidelijke lagen:
- frontend presentatie
- API layer
- search layer
- data ingestion layer
- processing layer
- storage layer
- background jobs
- affiliate layer

### 2.2 Schaalbaarheid door modulariteit
Elk onderdeel kan onafhankelijk schalen.

### 2.3 Data-first architectuur
Een vergelijkingsplatform draait om data kwaliteit, normalisatie, consistentie en snelheid.

### 2.4 SEO-first rendering
Landingspagina’s en detailpagina’s moeten server-rendered of statisch gegenereerd kunnen worden.

### 2.5 Flexibiliteit voor meerdere feeds
De eerste versie werkt met één feed, maar de architectuur moet later eenvoudig uitbreidbaar zijn met meer aanbieders.

---

## 3. Overzicht van de technische stack

### 3.1 Frontend
- Next.js voor frontend rendering
- TypeScript voor type safety
- Tailwind CSS voor UI styling
- Server Components waar passend
- Static Generation en Incremental Static Regeneration voor SEO pagina’s

### 3.2 API layer
- Next.js API routes of dedicated API service
- REST-API voor interne operaties
- GraphQL niet als eerste keuze, tenzij later nodig wordt

### 3.3 Search layer
- PostgreSQL + pgvector niet als primaire zoekengine voor faceted offer search
- Elasticsearch of OpenSearch als primaire zoekmotor voor snelle filtering, faceting en full-text search

### 3.4 Database
- PostgreSQL als primaire relationele database
- Redis voor cache en transient state
- object storage voor afbeeldingen

### 3.5 Background processing
- queue-based workers met BullMQ of RabbitMQ
- cron jobs of scheduled jobs voor feed polling, updates en reindexing

### 3.6 Feed processing
- ingestion service voor externe feeds
- data normalization pipeline
- matching and deduplication service
- price update pipeline

### 3.7 Hosting and infrastructure
- Vercel voor frontend en server-rendering
- managed PostgreSQL service
- managed Elasticsearch/OpenSearch service
- managed Redis service
- object storage provider zoals AWS S3, Cloudflare R2 of Vercel Blob
- containerized workers via Vercel/Cloud Run/AWS ECS of similar

---

## 4. Database keuze en motivatie

### 4.1 Primaire keuze: PostgreSQL
PostgreSQL is de beste primaire keuze voor VacationWeb omdat het:
- relationele data sterk ondersteunt;
- complexe queries, joins en aggregaties goed uitvoert;
- betrouwbare transacties biedt;
- goed combineert met een zoekindex;
- later eenvoudig uitbreidbaar is met nieuwe entiteiten.

### 4.2 Waarom niet alleen NoSQL
NoSQL is geschikt voor document-achtige data, maar voor VacationWeb zijn relaties belangrijk:
- hotels behoren tot bestemmingen en landen;
- offers behoren tot hotels en providers;
- affiliate links zijn gekoppeld aan providers en offers;
- prijsupdates en data-quality issues moeten traceerbaar zijn.

### 4.3 Database ontwerpprincipes
De database moet de volgende entiteiten ondersteunen:
- providers
- feeds
- hotels
- offers
- destinations
- regions
- countries
- affiliate links
- price updates
- data quality issues
- SEO pages
- content pages

### 4.4 Aanvullende opslagopties
- PostgreSQL voor structurele data
- Redis voor cache en snel toegankelijk state data
- object storage voor afbeeldingen en media

---

## 5. Zoekmachine keuze en motivatie

### 5.1 Primaire keuze: OpenSearch of Elasticsearch
Voor een vakantiesite met filtering, faceting en snelle resultatenlijsten is een echte zoekengine nodig.

Waarom niet alleen PostgreSQL?
- PostgreSQL kan filteren, maar wordt minder geschikt bij grote datasets en complexe faceted search
- filtering op prijs, sterren, board type, vertrekperiode en locatie wordt bij schaal snel complex
- search relevance en aggregaties zijn beter in een document search engine

### 5.2 Aanbevolen keuze
- OpenSearch wanneer een open-source, schaalbare aanpak gewenst is
- Elasticsearch wanneer een volwassen, veelgebruikte enterprise ervaring gewenst is

### 5.3 Waarom deze keuze past
Een zoekengine ondersteunt:
- snelle full-text zoekmogelijkheden
- faceted filters
- ranking van resultaten
- aggregation over velden
- snelle filters op grote datasets

### 5.4 Aanbevolen architectuur
- PostgreSQL is bron van waarheid voor relationele data
- OpenSearch/Elasticsearch bevat de geindexeerde, geaggregeerde aanboddata voor snelle zoekopdrachten
- index updates gebeuren via background workers wanneer feeds zijn verwerkt

### 5.5 Search index modellen
De zoekindex bevat een geoptimaliseerde “offer document” representatie met:
- hotelnaam
- destination name
- region name
- country name
- price
- price per day
- stars
- rating
- board type
- nights
- departure window
- provider name
- deeplink reference
- availability status

---

## 6. Hostingstrategie

### 6.1 Frontend hosting: Vercel
Vercel is een sterke keuze voor Next.js omdat het:
- uitstekende ondersteuning biedt voor SSR, SSG en ISR
- eenvoudig te deployen is
- goed werkt voor SEO-rende pagina’s
- eenvoudig te verbinden is met edge caching en serverless functies

### 6.2 Backend services
Voor de data-heavy onderdelen is een combinatie van:
- Vercel for app runtime
- managed PostgreSQL
- managed search service
- managed Redis
- worker services via serverless/background jobs

### 6.3 Waarom niet volledig één platform
Een volledig monolith op één platform is voor deze use case op termijn te beperkt. De data en worker processen verdienen een duidelijke scheiding.

### 6.4 Production target architecture
- frontend on Vercel
- API routes or separate API service on Vercel/managed platform
- workers on a dedicated worker runtime or container platform
- databases and search in managed services

---

## 7. Cachingstrategie

### 7.1 Waarom caching nodig is
VacationWeb zal veel publiekelijk beschikbare pagina’s en zoekresultaten tonen. Caching is nodig voor:
- snelheid
- lagere latency
- lagere kosten
- betere SEO-render performance

### 7.2 Caching lagen
1. Edge caching
   - statische assets
   - public page responses
   - cached landing pages

2. Application caching
   - frequently accessed search results
   - destination / country / theme page payloads
   - pricing summaries

3. Data caching
   - provider feed snapshots
   - normalized data objects
   - search index snapshots

### 7.3 Caching technologieën
- Redis voor fast application-level cache
- CDN/edge cache voor public content
- ISR/SSG for SEO pages

### 7.4 Cache invalidation strategy
Cache invalidation moet gebeuren op basis van:
- price update events
- feed refreshes
- content updates
- destination or theme updates

### 7.5 Cache policy rules
- search results: short-lived cache
- static content pages: longer-lived cache with revalidation
- pricing pages: frequent revalidation

---

## 8. Feedverwerking architectuur

### 8.1 Doel
De feedverwerking moet één feed (Corendon) kunnen verwerken, maar later eenvoudig uitbreidbaar zijn naar tientallen feeds.

### 8.2 Verwerkingsstroom
1. fetch feed from source
2. validate feed format
3. parse feed payload
4. map to canonical schema
5. normalize values
6. validate required fields
7. enrich with provider metadata
8. store raw feed snapshot
9. run matching and deduplication
10. update search index and database

### 8.3 Waarom een aparte feed pipeline nodig is
Feeds hebben verschillende structuren, frequenties en kwaliteitsniveaus. Een losse pipeline maakt het mogelijk om per aanbieder eigen mappingregels te beheren.

### 8.4 Feed processing components
- ingress worker
- parser module
- mapper module
- normalizer module
- validator module
- matcher module
- index updater

### 8.5 Raw data retention
Raw feed payloads moeten worden opgeslagen voor:
- debugging
- replaying broken imports
- audit trail
- future reprocessing

---

## 9. Background jobs en queue architectuur

### 9.1 Waarom background jobs nodig zijn
Feed imports, price updates, indexing en cache invalidation zijn te zwaar voor directe request handling.

### 9.2 Aanbevolen queue architectuur
- BullMQ over Redis voor job orchestration
- of RabbitMQ voor meer enterprise-style message routing

### 9.3 Voorbeeld jobtypes
- import feed job
- normalize feed job
- match hotels job
- update search index job
- refresh prices job
- invalidate cache job
- reindex landing pages job
- affiliate link validation job

### 9.4 Job orchestration model
Een import flow kan bestaan uit meerdere chained jobs:
1. fetch feed
2. normalize feed
3. save offers
4. update index
5. invalidate cache

### 9.5 Retry, backoff en dead-letter handling
Jobs moeten ondersteuning bieden voor:
- retries
- exponential backoff
- dead-letter queue
- alerting on repeated failures

---

## 10. Image handling

### 10.1 Waarom image handling belangrijk is
Vacaturevergelijkingssites zijn beeldrijk. Beelden zijn essentieel voor hotels, bestemmingen en landingpages.

### 10.2 Aanbevolen aanpak
- store originals in object storage
- generate responsive variants on ingest
- use CDN-backed image delivery
- lazy load images on frontend

### 10.3 Behandelingsstappen
1. download or reference image URL
2. transform to web-friendly formats
3. create multiple sizes
4. store in object storage
5. serve through CDN

### 10.4 Waarom object storage
Het maakt schaalbaarheid en media management eenvoudiger dan lokale files.

### 10.5 Image metadata
Elke image moet metadata krijgen zoals:
- source provider
- assigned hotel or destination
- size variants
- used for hero or card

---

## 11. SEO rendering strategie

### 11.1 Waarom SEO belangrijk is
VacationWeb heeft niet alleen een commerciële zoekervaring, maar ook een content- en landingpage-architectuur die door zoekmachines moet worden begrepen.

### 11.2 Aanbevolen renderingstrategie
- statische generatie voor landingpages en categoriepagina’s waar mogelijk
- server-side rendering voor dynamic zoekresultaten en detailpagina’s die vaak veranderen
- incremental static regeneration voor contentpagina’s en landingpagina’s

### 11.3 Gebruik van Next.js rendering
- SSG for destination, country, theme pages
- ISR for content pages that update periodically
- SSR for live search result pages and offer detail pages where freshness matters

### 11.4 SEO page types
- homepage
- search page
- results pages
- hotel pages
- destination pages
- country pages
- theme pages
- blog pages
- FAQ pages

### 11.5 SEO data requirements
Each page should have:
- title
- meta description
- canonical URL
- structured data where applicable
- breadcrumbs
- internal links

---

## 12. API architectuur

### 12.1 Doel
De API architectuur moet zowel frontend als interne services ondersteunen.

### 12.2 Aanbevolen API structuur
- public read APIs for search results, offers, destinations, SEO pages
- internal admin APIs for feed import, content management, price refresh
- webhook endpoints for partner feed updates where supported

### 12.3 API design principles
- versioned endpoints
- clear separation of read and write operations
- rate limiting for public APIs
- strong validation on inputs
- consistent JSON responses

### 12.4 API types
1. Search API
   - accepts search filters and returns offer results

2. Offer API
   - returns detailed offer data

3. Content API
   - returns landing page or blog data

4. Admin API
   - manages feed imports, mapping, status, retries

### 12.5 Why not a single monolithic API
A monolithic API becomes harder to evolve once multiple feeds, content types and background jobs are introduced. A modular API structure is safer.

---

## 13. Queue architectuur en event-driven principes

### 13.1 Waarom event-driven
Een vergelijkingsplatform werkt met meerdere onafhankelijke gebeurtenissen:
- feed import completed
- price changed
- offer added
- cache invalidated
- search reindex needed

### 13.2 Aanbevolen model
- jobs for processing
- events for notifications and downstream updates

### 13.3 Event types
- feed.imported
- feed.normalized
- offer.matched
- offer.updated
- price.updated
- cache.invalidated
- search.reindexed

### 13.4 voordelen
- losse services kunnen onafhankelijk reageren
- fouten zijn beter af te handelen
- uitbreiding naar nieuwe providers wordt makkelijker

---

## 14. Deployment strategie

### 14.1 Deployment principles
Deployment moet veilig, repeatable en schaalbaar zijn.

### 14.2 Aanbevolen approach
- infrastructure as code
- separate staging and production environments
- automated deployment pipelines
- database migrations in controlled stages
- blue/green or rolling deployment for services

### 14.3 Environment strategy
- development
- staging
- production

### 14.4 Release strategy
- frontend deployment independent from worker deployment
- database migrations separate from app deploys
- background jobs deploy independently

### 14.5 Operational needs
- monitoring
- alerting
- logs
- error tracking
- health checks

---

## 15. Observability en operations

### 15.1 Waarom observability essentieel is
Een platform met feeds, pricing updates, indexing en affiliate links moet goed traceerbaar zijn.

### 15.2 Monitoring focus areas
- feed import success/failure
- price update volume
- search latency
- index freshness
- cache hit rate
- 5xx errors
- affiliate link failures

### 15.3 Logging and tracing
- structured logs
- correlation IDs per import job
- trace IDs for request flow
- error dashboards

---

## 16. Security and compliance considerations

### 16.1 Security needs
- no secrets in frontend code
- secured admin APIs
- signed affiliate links where applicable
- rate limiting and abuse protection
- sanitization of external content

### 16.2 Compliance posture
- GDPR awareness for user data
- cookie and consent handling if analytics or tracking are used
- respect for partner terms and affiliate policies

---

## 17. Technology choices summary

### 17.1 Recommended core stack
- Frontend: Next.js + TypeScript + Tailwind
- Database: PostgreSQL
- Search: OpenSearch or Elasticsearch
- Cache: Redis
- Object storage: S3 / Cloudflare R2 / Vercel Blob
- Background jobs: BullMQ or RabbitMQ
- Hosting: Vercel for app, managed services for data layers
- Feed processing: dedicated worker services
- SEO rendering: SSG/ISR/SSR in Next.js

### 17.2 Why this stack fits VacationWeb
It balances:
- SEO performance
- scalability
- data integrity
- feed extensibility
- search performance
- operational maturity

---

## 18. Conclusion

VacationWeb needs a technical architecture that can start with one feed and grow into a multi-provider, high-volume comparison platform without re-architecting from scratch.

The recommended architecture centers around:
- PostgreSQL for relational truth
- OpenSearch or Elasticsearch for search and filtering
- Redis for caching and queue coordination
- asynchronous worker pipelines for feed ingestion and updates
- Next.js for SEO-first rendering and frontend experience
- object storage for images and media
- modular APIs and background jobs for future scaling

This architecture gives VacationWeb a strong technical foundation for long-term growth while staying practical in the first phase with Corendon as the initial feed.
