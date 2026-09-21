import Image from 'next/image';
import type { ExperienceMediaSlot } from '@/lib/discover/destination-experience-types';

type DestinationDesireProps = {
  title: string;
  body: string;
  media: ExperienceMediaSlot | null;
};

export function DestinationDesire({ title, body, media }: DestinationDesireProps) {
  return (
    <section className="mt-12" aria-labelledby="destination-desire-heading">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <h2
            id="destination-desire-heading"
            className="text-[1.35rem] font-semibold text-[#0A2D62]"
            style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
          >
            {title}
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[#0A2D62]/88">{body}</p>
        </div>
        {media ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-[16px]">
            <Image
              src={media.src}
              alt={media.placeLabel || title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 86vw, 40vw"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
