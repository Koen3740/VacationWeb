import Link from 'next/link';

type DestinationCompareCtaProps = {
  href: string;
  destinationName: string;
  size?: 'sm' | 'md';
};

/** Bridge CTA: Destination Page → existing Results flow. */
export function DestinationCompareCta({
  href,
  destinationName,
  size = 'md',
}: DestinationCompareCtaProps) {
  const cls =
    size === 'sm'
      ? 'inline-flex items-center rounded-full bg-[#0A2D62] px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-[#0c3a7a]'
      : 'inline-flex items-center rounded-full bg-[#0A2D62] px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#0c3a7a]';

  return (
    <Link href={href} className={cls}>
      Vergelijk vakanties naar {destinationName}
    </Link>
  );
}
