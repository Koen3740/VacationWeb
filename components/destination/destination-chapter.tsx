import Image from 'next/image';
import Link from 'next/link';
import type { ExperienceChapterBlock } from '@/lib/discover/destination-experience-types';

type DestinationChapterProps = {
  chapter: ExperienceChapterBlock;
  resultsHref: string;
};

/** Geographic chapter with varied image/text rhythm. */
export function DestinationChapter({ chapter, resultsHref }: DestinationChapterProps) {
  const primary = chapter.media[0];
  const secondary = chapter.media.slice(1);
  const imageFirst = chapter.layout === 'image-left' || chapter.layout === 'stack';

  return (
    <section
      id={chapter.id}
      className="mt-12 scroll-mt-20"
      aria-labelledby={`${chapter.id}-heading`}
    >
      <h2
        id={`${chapter.id}-heading`}
        className="text-[1.35rem] font-semibold text-[#0A2D62] sm:text-[1.5rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {chapter.title}
      </h2>
      <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-[#0A2D62]/88">
        {chapter.lead}
      </p>

      {chapter.layout === 'stack' && primary ? (
        <div className="mt-5">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px]">
            <Image
              src={primary.src}
              alt={primary.placeLabel || chapter.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 86vw, 900px"
            />
          </div>
          {primary.placeLabel ? (
            <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A2D62]/55">
              {primary.placeLabel}
            </p>
          ) : null}
        </div>
      ) : primary ? (
        <div
          className={`mt-5 grid gap-5 lg:grid-cols-2 lg:items-center ${
            imageFirst ? '' : 'lg:[&>*:first-child]:order-2'
          }`}
        >
          <div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px]">
              <Image
                src={primary.src}
                alt={primary.placeLabel || chapter.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 86vw, 45vw"
              />
            </div>
            {primary.placeLabel ? (
              <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A2D62]/55">
                {primary.placeLabel}
              </p>
            ) : null}
          </div>
          <div>
            {secondary.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {secondary.map((m) => (
                  <div key={m.assetId}>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[12px]">
                      <Image
                        src={m.src}
                        alt={m.placeLabel || ''}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 40vw, 20vw"
                      />
                    </div>
                    {m.placeLabel ? (
                      <p className="mt-1.5 text-[11px] text-[#0A2D62]/55">{m.placeLabel}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {chapter.contextualBridgeLabel ? (
        <p className="mt-5">
          <Link
            href={resultsHref}
            className="inline-flex rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0A2D62] ring-1 ring-[#0A2D62]/25 hover:bg-[#F5F0E8]"
          >
            {chapter.contextualBridgeLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
