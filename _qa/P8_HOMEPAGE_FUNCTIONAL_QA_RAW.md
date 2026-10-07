# P8 Homepage Functional QA — RAW matrix

ELEMENT | ROUTE/TARGET | RESULT | ACTIE
Logo | / | PASS | —
Nav Discover | /#ontdekt | PASS | —
Nav Zoeken | /#hero | PASS | —
Nav Bestemmingen | /bestemmingen | PASS | —
Nav Inspiratie | /#inspiratie | PASS | —
Nav Aanbod | /aanbiedingen | PASS | —
Nav Over ons | /#value | PASS (page /over-ons 404 — hash OK) | —
Opgeslagen | /favorieten | PASS | —
HomeSearch CTA | /results?… | PASS | —
Discover Albania | /ontdekt/albania | PASS | —
Discover Sicily | /ontdekt/sicily | PASS | —
Discover Crete | /ontdekt/crete | PASS | —
Discover Sardinia | /ontdekt/sardinia | PASS | —
Discover meer | /bestemmingen | PASS | —
Inspiration CTA | /ontdekt/sicily | PASS | —
Popular ×5 | /results?country=… | PASS | —
Newsletter Inschrijven | form submit | FAIL→PASS | type=submit + ack
Footer Ontdek links | /bestemmingen, /#inspiratie, /aanbiedingen | PASS | —
Footer Contact/FAQ | /#value | PASS as hash; real pages 404 | OUT OF SCOPE build pages
Social IG/FB/… | (spans) | N/A non-links | OUT OF SCOPE
Mobile menu open/close | panel | PASS after fix | xl:hidden + deferred close
Tablet 1100 menu | panel | PASS after fix | —
H-overflow mobile | — | PASS | —
Cookie gate | accept then browse | PASS | —