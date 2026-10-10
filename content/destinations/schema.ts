import type { DestinationDocument, DestinationVideo, GeoTarget, MediaAsset, ResultsLink } from '@/content/destinations/types';
import { isYoutubeVideoId } from '@/lib/discovery/youtube-embed';
import { resolveGeoHref, resolveResultsLink } from '@/lib/discovery/supported-geo';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONSENT = new Set(['analytics', 'marketing']);

function push(errors: string[], condition: boolean, message: string) {
  if (!condition) errors.push(message);
}

function checkMedia(errors: string[], media: MediaAsset, path: string, minWidth = 0) {
  push(errors, media.src.startsWith('/images/discovery/'), `${path}: image must live under /images/discovery/`);
  push(errors, media.alt.trim().length > 0, `${path}: alt is required`);
  push(errors, media.credit.includes('/'), `${path}: credit must name the photographer and source`);
  push(errors, media.photographer.trim().length > 0, `${path}: photographer is required`);
  push(errors, media.source === 'unsplash' || media.source === 'pexels', `${path}: source must be unsplash or pexels`);
  push(errors, media.licence === 'Unsplash' || media.licence === 'Pexels', `${path}: licence is required`);
  push(errors, media.sourceUrl.startsWith('https://'), `${path}: sourceUrl is required`);
  push(errors, media.width >= minWidth, `${path}: image width ${media.width} is below ${minWidth}`);
  push(errors, Boolean(media.objectPosition), `${path}: objectPosition is required`);
}

function checkGeo(errors: string[], geo: GeoTarget, path: string) {
  push(errors, geo.country.trim().length > 0, `${path}: country is required`);
}

function checkRequiredLink(errors: string[], link: ResultsLink, path: string) {
  checkGeo(errors, link.geo, path);
  push(errors, link.label.trim().length > 0, `${path}: label is required`);
  push(errors, resolveResultsLink(link) !== null, `${path}: no supported results URL for this link`);
}

function checkVideo(errors: string[], video: DestinationVideo, path: string) {
  push(errors, video.provider === 'youtube', `${path}: only YouTube embeds are allowed`);
  push(errors, isYoutubeVideoId(video.id), `${path}: invalid YouTube id`);
  push(errors, video.autoplay === false, `${path}: autoplay must be false`);
  push(errors, video.maker.startsWith('@'), `${path}: maker handle is required`);
  push(errors, video.makerUrl.startsWith('https://www.youtube.com/'), `${path}: makerUrl must be a YouTube channel`);
  push(errors, video.watchUrl.startsWith('https://www.youtube.com/'), `${path}: watchUrl must be YouTube`);
  push(errors, !/instagram\.com/i.test(video.watchUrl), `${path}: Instagram embeds are not allowed`);
  push(errors, CONSENT.has(video.consentCategory), `${path}: consent category must be analytics or marketing`);
  push(errors, video.watchUrl.includes(video.id), `${path}: watchUrl must contain the video id`);
}

export function validateDestinationDocument(doc: DestinationDocument): string[] {
  const errors: string[] = [];
  const where = doc.slug || '(missing slug)';
  push(errors, SLUG.test(doc.slug), `${where}: slug must be lowercase`);
  push(errors, doc.name.trim().length > 0, `${where}: name is required`);
  push(errors, doc.country.trim().length > 0, `${where}: country is required`);
  push(errors, resolveGeoHref({ country: doc.country, region: doc.region }) !== null, `${where}: country/region is not a supported destination`);

  if (doc.chip) {
    push(errors, doc.chip.label.trim().length > 0, `${where}: chip label is required`);
    push(errors, resolveGeoHref(doc.chip.geo) !== null, `${where}: chip does not resolve to a supported destination`);
  }

  for (const card of doc.discoveryCards) {
    const path = `${where} card ${card.id}`;
    checkMedia(errors, card.image, path);
    checkRequiredLink(errors, card.results, path);
    push(errors, card.badges.includes('video') ? Boolean(doc.video) : true, `${path}: video badge requires a video embed`);
  }

  for (const story of doc.stories) {
    const path = `${where} story ${story.id}`;
    checkMedia(errors, story.image, path);
    checkRequiredLink(errors, story.results, path);
  }

  if (!doc.longread) {
    push(errors, !doc.chapters?.length, `${where}: discovery-only entries have no chapters`);
    return errors;
  }

  push(errors, Boolean(doc.hero), `${where}: longread needs a hero`);
  if (doc.hero) {
    checkMedia(errors, doc.hero.image, `${where} hero`, 1700);
    push(errors, doc.hero.intro.trim().length > 0, `${where}: hero intro is required`);
  }
  push(errors, (doc.intro?.paragraphs.length ?? 0) >= 2, `${where}: intro needs at least two paragraphs`);
  const chapterCount = doc.chapters?.length ?? 0;
  push(errors, chapterCount >= 4 && chapterCount <= 5, `${where}: a longread has 4 or 5 chapters`);
  for (const chapter of doc.chapters ?? []) {
    const path = `${where} chapter ${chapter.id}`;
    checkMedia(errors, chapter.image, path, 1700);
    push(errors, chapter.paragraphs.length >= 3, `${path}: needs 3 or 4 paragraphs`);
    push(errors, chapter.fact.text.trim().length > 0, `${path}: fact text is required`);
    push(errors, chapter.fact.source.trim().length > 0, `${path}: fact source is required`);
    push(errors, chapter.fact.sourceUrl.startsWith('https://'), `${path}: fact sourceUrl is required`);
    checkRequiredLink(errors, chapter.results, path);
  }
  if (doc.video) checkVideo(errors, doc.video, `${where} video`);
  for (const place of doc.places ?? []) {
    checkMedia(errors, place.image, `${where} place ${place.name}`);
    checkGeo(errors, place.geo, `${where} place ${place.name}`);
  }
  for (const region of doc.regions ?? []) {
    checkMedia(errors, region.image, `${where} region ${region.id}`);
    checkGeo(errors, region.geo, `${where} region ${region.id}`);
    for (const place of region.places) {
      checkGeo(errors, place.geo, `${where} region place ${place.name}`);
    }
  }
  if (doc.practical) {
    for (const row of doc.practical.bestPeriod.rows) {
      push(errors, row.months.length === 12, `${where}: season row ${row.label} needs 12 months`);
    }
  }
  if (doc.finalCta) {
    checkMedia(errors, doc.finalCta.image, `${where} final`);
    checkRequiredLink(errors, doc.finalCta.results, `${where} final`);
  } else {
    errors.push(`${where}: longread needs a final CTA`);
  }
  return errors;
}

export function validateDestinationCollection(docs: readonly DestinationDocument[]): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  for (const doc of docs) {
    if (slugs.has(doc.slug)) errors.push(`duplicate slug ${doc.slug}`);
    slugs.add(doc.slug);
    errors.push(...validateDestinationDocument(doc));
  }
  const longreads = docs.filter((doc) => doc.longread);
  push(errors, longreads.length > 0, 'collection needs at least one longread');
  return errors;
}
