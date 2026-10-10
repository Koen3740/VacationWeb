'use client';

import { YouTubeEmbedView } from '@/components/discovery/youtube-embed-view';
import { useConsent } from '@/components/consent/consent-provider';
import type { DestinationVideo } from '@/content/destinations/types';
import { getCookieConsent, setCookiePreferences } from '@/lib/cookie-consent';
import { canShowYoutubeEmbed } from '@/lib/discovery/youtube-embed';

/**
 * Loads the YouTube iframe only after the visitor has accepted the video's
 * cookie category through the existing consent store.
 */
export function YouTubeConsentEmbed({ video }: { video: DestinationVideo }) {
  const consent = useConsent();
  const allowed =
    consent.ready &&
    canShowYoutubeEmbed(
      { analytics: consent.analyticsAllowed, marketing: consent.marketingAllowed },
      video.consentCategory,
    );

  function acceptCategory() {
    const current = getCookieConsent();
    setCookiePreferences({
      analytics: video.consentCategory === 'analytics' ? true : Boolean(current?.analytics),
      marketing: video.consentCategory === 'marketing' ? true : Boolean(current?.marketing),
    });
  }

  return <YouTubeEmbedView video={video} allowed={allowed} onAccept={acceptCategory} />;
}
