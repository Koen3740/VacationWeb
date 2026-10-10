'use client';

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  isTravelersStateComplete,
  writeTravelersToQuery,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import type { DetailRoomQuote } from '@/lib/providers/sunweb/room-selector';
import type { TravelerModel } from '@/lib/search/traveler-contract';

const PENDING_COPY = 'Prijs wordt opgehaald…';

function formatPartyEuro(amount: number): string {
  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `€\u00a0${formatted}`;
}

/** renderToStaticMarkup has no app router. The live page uses next/navigation. */
function useDetailRouter(): { replace: (href: string, options?: { scroll?: boolean }) => void } {
  try {
    return useRouter();
  } catch {
    return { replace: () => {} };
  }
}

type AdjustContextValue = {
  pending: boolean;
  open: boolean;
  draft: TravelersState;
  openPopup: () => void;
  closePopup: () => void;
  setDraft: (next: TravelersState) => void;
  selectRoom: (roomId: string) => void;
};

const AdjustContext = createContext<AdjustContextValue | null>(null);

function useAdjust(): AdjustContextValue {
  const value = useContext(AdjustContext);
  if (!value) {
    throw new Error('Detail adjust controls are outside their provider');
  }
  return value;
}

function partyHref(pagePath: string, preservedQuery: string, travelers: TravelersState, roomId?: string): string {
  const query = new URLSearchParams(preservedQuery);
  writeTravelersToQuery(query, travelers);
  query.delete('tripDate');
  query.delete('dob');
  if (roomId) {
    query.set('room', roomId);
  } else {
    query.delete('room');
  }
  const search = query.toString();
  return search ? `${pagePath}?${search}` : pagePath;
}

export function DetailAdjustProvider({
  pagePath,
  preservedQuery,
  initial,
  children,
}: {
  pagePath: string;
  /** Current detail query without traveller, room and tripDate keys. */
  preservedQuery: string;
  initial: TravelerModel;
  children: ReactNode;
}) {
  const router = useDetailRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TravelersState>(initial);

  function navigate(href: string) {
    const current = partyHref(pagePath, preservedQuery, initial);
    if (href === current) {
      return;
    }
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const value: AdjustContextValue = {
    pending,
    open,
    draft,
    openPopup: () => {
      setDraft(initial);
      setOpen(true);
    },
    closePopup: () => {
      setOpen(false);
      if (!isTravelersStateComplete(draft)) {
        setDraft(initial);
        return;
      }
      navigate(partyHref(pagePath, preservedQuery, draft));
    },
    setDraft,
    selectRoom: (roomId) => {
      navigate(partyHref(pagePath, preservedQuery, initial, roomId));
    },
  };

  return <AdjustContext.Provider value={value}>{children}</AdjustContext.Provider>;
}

type TravelersPopupComponent = typeof import('@/components/search/travelers-popup/travelers-popup').TravelersPopup;

export function DetailPartySummary({ label }: { label: string }) {
  const adjust = useAdjust();
  const [Popup, setPopup] = useState<TravelersPopupComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Client-only: the popup stylesheet is not valid in the node test runner.
    void import('@/components/search/travelers-popup/travelers-popup').then((mod) => {
      if (!cancelled) {
        setPopup(() => mod.TravelersPopup);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={adjust.openPopup}
        data-testid="detail-party-summary"
        className="mt-6 text-left text-sm font-semibold text-vw-navy"
      >
        {label} · Wijzigen
      </button>
      {Popup ? (
        <Popup
          open={adjust.open}
          travelers={adjust.draft}
          onClose={adjust.closePopup}
          onChange={adjust.setDraft}
        />
      ) : null}
    </>
  );
}

/** Parked with the room-selector flag. The detail page does not mount this while the flag is off. */
export function DetailAdjustRooms({
  rooms,
  selectedId,
  provider,
}: {
  rooms: DetailRoomQuote[];
  selectedId?: string;
  provider: string;
}) {
  const adjust = useAdjust();
  if (rooms.length === 0) {
    return null;
  }
  return (
    <section className="mt-6 rounded-[20px] border border-vw-line bg-vw-card p-5 shadow-vw-panel min-[901px]:p-7" data-testid="detail-room-choice">
      <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Kies je kamer</h2>
      <div className="mt-4 grid gap-2.5">
        {rooms.map((room) => {
          const selected = selectedId === room.id;
          const priced = typeof room.totalPrice === 'number';
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => adjust.selectRoom(room.id)}
              aria-current={selected ? 'true' : undefined}
              data-testid={priced ? 'detail-room-priced' : 'detail-room-unpriced'}
              className={`block rounded-2xl border px-4 py-3.5 text-left ${
                selected
                  ? 'border-vw-navy bg-[#f1f4fa] shadow-[inset_0_0_0_1px_var(--vw-navy)]'
                  : 'border-[#e3dccf] bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="break-words text-[15px] font-semibold text-vw-navy">{room.name}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#98a1b2]">
                    Code {room.id}
                  </p>
                  {room.capacityText ? (
                    <p className="mt-0.5 text-[13px] text-vw-muted">{room.capacityText}</p>
                  ) : null}
                </div>
                {selected ? (
                  <span className="rounded-full bg-vw-navy px-2.5 py-0.5 text-[11.5px] font-semibold text-white">
                    Geselecteerd
                  </span>
                ) : null}
              </div>
              {priced ? (
                <p className="mt-2 text-sm text-vw-navy">
                  <span className="font-semibold text-vw-green">Prijs gebaseerd op deze kamer</span>
                  <span className="mt-0.5 block font-bold">Totaal {formatPartyEuro(room.totalPrice as number)}</span>
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-[#475569]">
                  Prijs voor deze kamer zie je bij {provider}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DetailAdjustPrice({ children }: { children: ReactNode }) {
  const { pending } = useAdjust();
  if (pending) {
    return (
      <div
        className="rounded-[20px] border border-vw-line bg-vw-card p-5 text-sm font-semibold text-vw-navy shadow-vw-panel"
        data-testid="detail-price-pending"
      >
        {PENDING_COPY}
      </div>
    );
  }
  return <>{children}</>;
}

export function DetailAdjustMobile({ children }: { children: ReactNode }) {
  const { pending } = useAdjust();
  if (pending) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-vw-line bg-[rgba(255,253,249,0.96)] px-4 py-3 text-sm font-semibold text-vw-navy min-[901px]:hidden"
        data-testid="detail-book-bar"
      >
        {PENDING_COPY}
      </div>
    );
  }
  return <>{children}</>;
}
