import type { ConsentCategory } from '@/content/destinations/types';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,32}$/;

export function isYoutubeVideoId(id: string): boolean {
  return YOUTUBE_ID.test(id);
}

/**
 * Privacy-enhanced embed URL. Autoplay is never set: playback data must not
 * start before the visitor presses play inside the player.
 */
export function youtubeNocookieEmbedSrc(id: string): string {
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

export function canShowYoutubeEmbed(
  allowed: { analytics: boolean; marketing: boolean },
  category: ConsentCategory,
): boolean {
  return category === 'analytics' ? allowed.analytics : allowed.marketing;
}
