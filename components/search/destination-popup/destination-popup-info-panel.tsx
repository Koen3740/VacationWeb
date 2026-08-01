import leftPanelIllustration from '@/components/search/destination-popup/assets/left-panel-illustration.png';
import { loadTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import Image from 'next/image';

function PalmIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C10.5 6 8 7.5 5 8c3 1 5 3 5.5 6C8 13 6 11 4 8c2 3 5 5 8 5.5V21h2v-7.5c3-.5 6-2.5 8-5.5-2 3-4 5-6.5 6 .5-3 2.5-5 5.5-6-3-.5-5.5-2-7-5z"
        fill="#0EA5E9"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 2c2.2 0 6 1.1 6 3.5V19H10v-2.5C10 14.1 13.8 13 16 13ZM2 19v-2.5C2 14.1 5.8 13 8 13c.7 0 1.4.1 2 .2A4.9 4.9 0 0 0 8 17.5V19H2Z"
        fill="#2563EB"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Zm2-1h4V7H10ZM5 9v10h14V9H5Z"
        fill="#2563EB"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 12-3-3 1.4-1.4L11 11.2l4.6-4.6L17 8l-6 6Z"
        fill="#2563EB"
      />
    </svg>
  );
}

export async function DestinationPopupInfoPanel() {
  const totalOffersLabel = await loadTotalOffersLabel();

  return (
    <aside className="relative hidden w-[300px] shrink-0 overflow-hidden bg-[#E0F2FE] lg:flex lg:flex-col">
      <Image
        src={leftPanelIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] w-full object-cover object-bottom"
      />

      <div className="relative z-10 flex flex-1 flex-col px-8 pb-8 pt-10">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E0F2FE]">
          <PalmIcon />
        </div>

        <h2 className="mt-8 text-2xl font-semibold leading-8 text-[#0F172A]">
          Vind jouw ideale vakantie
        </h2>
        <p className="mt-4 text-sm leading-8 text-[#475569]">
          Kies één of meerdere bestemmingen en ontdek alle vakanties die hierbij passen.
        </p>

        <ul className="mt-8 space-y-5">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <PeopleIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Meerdere bestemmingen</p>
              <p className="mt-1 text-sm leading-6 text-[#475569]">
                Vergelijk vakanties in meerdere landen tegelijk.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <BriefcaseIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{totalOffersLabel}</p>
              <p className="mt-1 text-sm leading-6 text-[#475569]">
                Actueel aanbod van meerdere reisorganisaties.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <ShieldIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Eerlijk en onafhankelijk</p>
              <p className="mt-1 text-sm leading-6 text-[#475569]">
                Wij tonen alle aanbiedingen objectief op één plaats.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </aside>
  );
}
