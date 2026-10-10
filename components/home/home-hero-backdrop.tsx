import { getImageProps } from 'next/image';
import { HomePhotoDim } from '@/components/home/home-photo-dim';
import { HOMEPAGE_HERO_PHOTO } from '@/lib/home/homepage-hero-photo';

/**
 * Full-bleed homepage photo. One fixed layer, separate desktop and mobile
 * crops. The photo is a fixed element, which keeps working on iOS.
 */
export function HomeHeroBackdrop() {
  const photo = HOMEPAGE_HERO_PHOTO;
  const shared = { alt: '', sizes: '100vw', quality: 75 } as const;
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({
    ...shared,
    src: photo.mobile.src,
    width: photo.mobile.width,
    height: photo.mobile.height,
  });
  const { props: desktopProps } = getImageProps({
    ...shared,
    src: photo.desktop.src,
    width: photo.desktop.width,
    height: photo.desktop.height,
    priority: true,
  });

  return (
    <div
      className="vw-home-photo"
      style={{
        ['--vw-home-photo-pos' as string]: photo.desktop.objectPosition,
        ['--vw-home-photo-pos-mobile' as string]: photo.mobile.objectPosition,
      }}
      aria-hidden
    >
      <picture>
        <source media="(max-width: 640px)" srcSet={mobileSrcSet} />
        <img {...desktopProps} alt="" className="vw-home-photo-img" />
      </picture>
      <div className="vw-home-photo-shade" />
      <HomePhotoDim />
    </div>
  );
}
