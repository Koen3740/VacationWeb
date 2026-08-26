import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  boardTypeLabelForDutchUi,
  cardBlurbForDutchUi,
  extraInfoLabelForDutchUi,
  hasDutchProviderListing,
  isLikelyFrenchCopy,
  preferredDutchCatalogCopy,
  translateFrenchCatalogPhraseToDutch,
} from './ui-locale';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-1',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Turkije',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/x',
    ...overrides,
  };
}

test('French BE-FR marketing copy is detected', () => {
  assert.equal(
    isLikelyFrenchCopy(
      "L'hôtel Linda Sunny Beach est un établissement tout compris situé à seulement 300 mètres de la plage.",
    ),
    true,
  );
  assert.equal(
    isLikelyFrenchCopy(
      'Les merveilleux Appartements Sol Puerto Marina (ex. Sol Timor) se trouvent à côté de la promenade de la plage de Carihuela. Depuis la terrasse ensoleillée au bord de la piscine, vous pouvez admirer la',
    ),
    true,
  );
  assert.equal(
    isLikelyFrenchCopy('Zonnig hotel direct aan het strand in Alanya.'),
    false,
  );
});

test('Dutch listing with Dutch localized text uses that copy instead of French short text', () => {
  const offer = makeOffer({
    listingHost: 'www.corendon.be',
    feedSourceId: 'corendon-benl',
    descriptionShort:
      'Les merveilleux Appartements Sol Puerto Marina se trouvent à côté de la promenade.',
    localizedDescriptions: {
      'fr-BE': 'Les merveilleux Appartements Sol Puerto Marina se trouvent à côté de la promenade.',
      'nl-BE': 'De appartementen van Sol Puerto Marina liggen aan de boulevard van Carihuela.',
    },
  });
  assert.equal(
    cardBlurbForDutchUi(offer, offer.descriptionShort, { allowLocalizedFallback: true }),
    'De appartementen van Sol Puerto Marina liggen aan de boulevard van Carihuela.',
  );
});

test('known BE-FR room enrichment is translated to Dutch, not hidden', () => {
  const phrase = 'Chambre 2 personnes + extra bed (Classe Enfant 2)';
  assert.equal(
    translateFrenchCatalogPhraseToDutch(phrase),
    '2-persoonskamer + extra bed (Kinderklasse 2)',
  );

  const offer = makeOffer({
    listingHost: 'www.corendon.be',
    feedSourceId: 'corendon-benl',
    extraInfo: phrase,
  });
  assert.equal(
    extraInfoLabelForDutchUi(offer, offer.extraInfo),
    '2-persoonskamer + extra bed (Kinderklasse 2)',
  );
});

test('unmapped French marketing copy stays out of NL Results', () => {
  const offer = makeOffer({
    listingHost: 'www.corendon.be',
    feedSourceId: 'corendon-benl',
    descriptionShort:
      'Les merveilleux Appartements Sol Puerto Marina (ex. Sol Timor) se trouvent à côté de la promenade de la plage de Carihuela. Depuis la terrasse ensoleillée au bord de la piscine, vous pouvez admirer la',
  });
  assert.equal(cardBlurbForDutchUi(offer, offer.descriptionShort), undefined);
});

test('unique BE-FR-only offer translates known phrases; hides unmapped French', () => {
  const offer = makeOffer({
    feedSourceId: 'corendon-befr',
    listingHost: 'fr.corendon.be',
    providerListings: [{ provider: 'Corendon', feedId: 'corendon-befr', host: 'fr.corendon.be', locale: 'fr-BE', deepLink: 'https://fr.corendon.be/x' }],
    descriptionShort:
      "L'hôtel Linda Sunny Beach est un établissement tout compris situé à seulement 300 mètres de la plage.",
    extraInfo: 'Chambre double standard',
  });
  assert.equal(hasDutchProviderListing(offer), false);
  assert.equal(cardBlurbForDutchUi(offer, offer.descriptionShort), undefined);
  assert.equal(extraInfoLabelForDutchUi(offer, offer.extraInfo), '2-persoonskamer Standaard');
});

test('French board labels canonicalize to Dutch', () => {
  assert.equal(boardTypeLabelForDutchUi('Chambre et petit déjeuner'), 'Logies & ontbijt');
  assert.equal(boardTypeLabelForDutchUi('Logies en ontbijt'), 'Logies & ontbijt');
});

test('Detail catalog copy prefers stored nl-BE / nl-NL localized text', () => {
  const offer = makeOffer({
    descriptionLong: "L'hôtel est situé à seulement 100 mètres.",
    localizedDescriptions: {
      'fr-BE': "L'hôtel est situé à seulement 100 mètres.",
      'nl-BE': 'Het hotel ligt op 100 meter van het strand.',
    },
  });
  assert.equal(preferredDutchCatalogCopy(offer), 'Het hotel ligt op 100 meter van het strand.');
});
