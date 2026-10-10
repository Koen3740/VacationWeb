import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DESTINATIONS } from '@/content/destinations';
import { validateDestinationCollection, validateDestinationDocument } from '@/content/destinations/schema';
import type { DestinationDocument } from '@/content/destinations/types';

test('destination collection matches the schema', () => {
  assert.deepEqual(validateDestinationCollection(DESTINATIONS), []);
});

test('every image file exists and credits name a source', () => {
  const images = DESTINATIONS.flatMap((doc) => [
    ...doc.discoveryCards.map((card) => card.image),
    ...doc.stories.map((story) => story.image),
    ...(doc.hero ? [doc.hero.image] : []),
    ...(doc.chapters ?? []).map((chapter) => chapter.image),
    ...(doc.places ?? []).map((place) => place.image),
    ...(doc.regions ?? []).map((region) => region.image),
    ...(doc.finalCta ? [doc.finalCta.image] : []),
  ]);
  assert.ok(images.length > 0);
  for (const image of images) {
    assert.equal(existsSync(join(process.cwd(), 'public', image.src)), true, image.src);
    assert.match(image.credit, /\/ (Unsplash|Pexels)/);
    assert.match(image.licence, /Unsplash|Pexels/);
  }
});

test('Albanië longread keeps the verified YouTube short and a sourced fact per chapter', () => {
  const albania = DESTINATIONS.find((doc) => doc.slug === 'albanie');
  assert.ok(albania);
  assert.equal(albania.video?.provider, 'youtube');
  assert.equal(albania.video?.id, 'RaNkjYE-dwM');
  assert.equal(albania.video?.maker, '@olsimeraj');
  assert.equal(albania.video?.autoplay, false);
  assert.equal(albania.video?.consentCategory, 'marketing');
  assert.equal(albania.chapters?.length, 4);
  for (const chapter of albania.chapters ?? []) {
    assert.ok(chapter.fact.sourceUrl.startsWith('https://'));
    assert.ok(chapter.fact.source.length > 0);
  }
});

test('schema rejects autoplay and non-YouTube embeds', () => {
  const albania = DESTINATIONS.find((doc) => doc.slug === 'albanie');
  assert.ok(albania?.video);
  const autoplay = {
    ...albania,
    video: { ...albania.video, autoplay: true },
  } as unknown as DestinationDocument;
  assert.ok(validateDestinationDocument(autoplay).some((error) => /autoplay/.test(error)));

  const instagram = {
    ...albania,
    video: { ...albania.video, watchUrl: 'https://www.instagram.com/reel/abc', provider: 'instagram' },
  } as unknown as DestinationDocument;
  const errors = validateDestinationDocument(instagram);
  assert.ok(errors.some((error) => /YouTube|Instagram/.test(error)));
});
