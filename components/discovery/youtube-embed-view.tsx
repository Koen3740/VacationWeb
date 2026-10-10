import type { DestinationVideo } from '@/content/destinations/types';
import { youtubeNocookieEmbedSrc } from '@/lib/discovery/youtube-embed';

/**
 * Presentational YouTube frame. The iframe is omitted until `allowed` is true,
 * so a render without consent never requests YouTube.
 */
export function YouTubeEmbedView({
  video,
  allowed,
  onAccept,
}: {
  video: DestinationVideo;
  allowed: boolean;
  onAccept?: () => void;
}) {
  return (
    <figure className="mx-auto w-full max-w-[min(390px,calc((100svh-170px)*0.5625))]">
      <div className="overflow-hidden rounded-[22px] bg-black shadow-[0_0_0_1px_rgba(255,255,255,.12),0_30px_80px_rgba(0,0,0,.55)]">
        {allowed ? (
          <iframe
            className="block aspect-[9/16] w-full border-0 bg-black"
            src={youtubeNocookieEmbedSrc(video.id)}
            title={`YouTube-video van ${video.maker}`}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="relative flex aspect-[9/16] flex-col justify-between bg-[linear-gradient(160deg,#0f6e7a_0%,#071a36_100%)] p-5 text-white">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M10 9v6l5-3z" fill="currentColor" />
              </svg>
              YouTube-short
            </span>
            <span>
              <b className="block font-vw-serif text-[34px] font-medium leading-tight">{video.kicker}</b>
              <small className="mt-2 block max-w-[28ch] text-[14px] font-normal leading-snug opacity-90">
                {video.description}
              </small>
            </span>
            <span className="flex flex-col items-start gap-2.5">
              <span className="max-w-[26ch] text-[14px] font-medium leading-snug">
                <b className="mb-1.5 block font-vw-serif text-[24px] font-medium leading-tight">
                  🍪 Deze video eet alleen cookies.
                </b>
                Eéntje mag?
              </span>
              <button
                type="button"
                onClick={onAccept}
                className="inline-flex h-11 items-center rounded-full bg-white px-[18px] font-vw-sans text-[14px] font-semibold text-vw-navy"
              >
                Ja, smakelijk!
              </button>
              <a
                href={video.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-white"
              >
                Bekijk op YouTube
              </a>
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-2.5 text-center text-[12.5px] text-[#9fb0cc]">
        Video:{' '}
        <a href={video.makerUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-white">
          {video.maker}
        </a>{' '}
        op YouTube
      </figcaption>
    </figure>
  );
}
