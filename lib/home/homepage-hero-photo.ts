/**
 * Homepage hero photo — the one entry to swap after visitor feedback.
 *
 * Replace this object (files, crop positions, credit). The fixed photo layer
 * reads only `HOMEPAGE_HERO_PHOTO`. The page renders a `position: fixed`
 * layer (a fixed background attachment breaks on iOS).
 *
 * Current choice: photo 1 from the homepage lab, Cefalù, Sicilië
 * (sea with a warm purple glow). Desktop object-position matches the lab
 * (`55% 50%`). The mobile file is a separate portrait crop of that same
 * frame, biased the way the lab's `70% 50%` cover crop keeps the subject
 * in a 390×844 viewport, so the mobile file itself uses `50% 50%`.
 *
 * Unsplash photo page was not readable from this environment (bot check),
 * and the JPEG has no photographer EXIF. Credit the photo id and licence;
 * do not invent a contributor name.
 */
export const HOMEPAGE_HERO_PHOTO = {
  id: 'cefalu',
  name: 'Cefalù, Sicilië',
  note: 'Zee met warme paarse gloed',
  desktop: {
    src: '/images/home/hero/cefalu-desktop.jpg',
    width: 2400,
    height: 1600,
    objectPosition: '55% 50%',
  },
  mobile: {
    src: '/images/home/hero/cefalu-mobile.jpg',
    width: 1080,
    height: 2337,
    objectPosition: '50% 50%',
  },
  credit: {
    place: 'Cefalù, Sicilië',
    source: 'Unsplash',
    licence: 'Unsplash License',
    licenceUrl: 'https://unsplash.com/license',
    photoPage: 'https://unsplash.com/photos/spC0l5B5068',
    unsplashPhotoId: 'photo-1597606904453-920ac2eb8efb',
    unsplashUid: 'spC0l5B5068',
  },
} as const;
