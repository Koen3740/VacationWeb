'use client';

import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { DetailRoomQuote } from '@/lib/providers/sunweb/room-selector';
import { writeTravelerQuery, type TravelerModel } from '@/lib/search/traveler-contract';

const PENDING_COPY = 'Prijs wordt opgehaald…';
const DEBOUNCE_MS = 400;

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
  adults: number;
  childAges: number[];
  roomCount: number;
  assignments: number[];
  tripDate: string;
  setAdults: (value: number) => void;
  setChildAge: (index: number, age: number) => void;
  addChild: () => void;
  removeChild: (index: number) => void;
  setRoomCount: (value: number) => void;
  setTripDate: (value: string) => void;
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

function assignmentsFor(adults: number, childAges: number[], roomCount: number): number[] {
  const persons = adults + childAges.length;
  const rooms = persons < 2 ? 1 : roomCount;
  if (rooms <= 1) {
    return Array.from({ length: persons }, () => 0);
  }
  const assigned = Array.from({ length: persons }, () => 0);
  if (adults >= 2) {
    assigned[1] = 1;
  } else if (childAges.length > 0) {
    assigned[adults] = 1;
  }
  return assigned;
}

export function DetailAdjustProvider({
  pagePath,
  preservedQuery,
  offerDate,
  initialDate,
  showDate,
  initial,
  selectedRoomId,
  children,
}: {
  pagePath: string;
  /** Current detail query without traveller, room and tripDate keys. */
  preservedQuery: string;
  /** Offer departure date. A different visitor date is written as tripDate. */
  offerDate: string;
  initialDate: string;
  showDate: boolean;
  initial: TravelerModel;
  selectedRoomId?: string;
  children: ReactNode;
}) {
  const router = useDetailRouter();
  const [pending, startTransition] = useTransition();
  const [adults, setAdultsState] = useState(initial.adults);
  const [childAges, setChildAges] = useState(initial.childAges);
  const [roomCount, setRoomCountState] = useState(initial.roomCount);
  const [assignments, setAssignments] = useState(initial.roomAssignments);
  const [tripDate, setTripDate] = useState(initialDate);
  const [roomId, setRoomId] = useState(selectedRoomId);
  const [ready, setReady] = useState(false);

  const signature = `${initial.adults}:${initial.childAges.join(',')}:${initial.roomCount}:${initial.roomAssignments.join(',')}:${initialDate}:${selectedRoomId ?? ''}`;

  useEffect(() => {
    setAdultsState(initial.adults);
    setChildAges(initial.childAges);
    setRoomCountState(initial.roomCount);
    setAssignments(initial.roomAssignments);
    setTripDate(initialDate);
    setRoomId(selectedRoomId);
    setReady(true);
  }, [signature]);

  const requested = useMemo(() => {
    const model: TravelerModel = {
      adults,
      childAges,
      roomCount: adults + childAges.length < 2 ? 1 : roomCount,
      roomAssignments: assignments,
    };
    const query = new URLSearchParams(preservedQuery);
    writeTravelerQuery(query, model);
    if (showDate && tripDate && tripDate !== offerDate) {
      query.set('tripDate', tripDate);
    } else {
      query.delete('tripDate');
    }
    if (roomId) {
      query.set('room', roomId);
    } else {
      query.delete('room');
    }
    return `${pagePath}?${query.toString()}`;
  }, [adults, assignments, childAges, offerDate, pagePath, preservedQuery, roomCount, roomId, showDate, tripDate]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const baseline = new URLSearchParams(preservedQuery);
    writeTravelerQuery(baseline, initial);
    if (showDate && initialDate && initialDate !== offerDate) {
      baseline.set('tripDate', initialDate);
    }
    if (selectedRoomId) {
      baseline.set('room', selectedRoomId);
    }
    const currentHref = `${pagePath}?${baseline.toString()}`;
    if (requested === currentHref) {
      return;
    }
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(requested, { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [initial, initialDate, offerDate, pagePath, preservedQuery, requested, ready, router, selectedRoomId, showDate]);

  const value: AdjustContextValue = {
    pending,
    adults,
    childAges,
    roomCount: adults + childAges.length < 2 ? 1 : roomCount,
    assignments,
    tripDate,
    setAdults: (next) => {
      const count = Math.min(6, Math.max(1, next));
      setAdultsState(count);
      setAssignments(assignmentsFor(count, childAges, roomCount));
    },
    setChildAge: (index, age) => {
      setChildAges((current) => current.map((item, itemIndex) => (itemIndex === index ? age : item)));
    },
    addChild: () => {
      if (childAges.length >= 4) {
        return;
      }
      const next = [...childAges, 8];
      setChildAges(next);
      setAssignments(assignmentsFor(adults, next, roomCount));
    },
    removeChild: (index) => {
      const next = childAges.filter((_, itemIndex) => itemIndex !== index);
      setChildAges(next);
      setAssignments(assignmentsFor(adults, next, roomCount));
    },
    setRoomCount: (next) => {
      const count = next === 2 && adults + childAges.length >= 2 ? 2 : 1;
      setRoomCountState(count);
      setAssignments(assignmentsFor(adults, childAges, count));
    },
    setTripDate: (next) => setTripDate(next),
    selectRoom: (next) => setRoomId(next),
  };

  return <AdjustContext.Provider value={value}>{children}</AdjustContext.Provider>;
}

export function DetailAdjustPanel({
  showDate,
  minDate,
}: {
  showDate: boolean;
  minDate: string;
}) {
  const adjust = useAdjust();
  return (
    <section className="mt-6 rounded-[20px] border border-vw-line bg-vw-card p-5 shadow-vw-panel min-[901px]:p-7" data-testid="detail-trip-adjust">
      <h2 className="font-vw-serif text-2xl font-medium text-vw-navy">Pas je reis aan</h2>
      <p className="mt-1 text-[13px] text-vw-muted">
        Leeftijd van een kind is de leeftijd op de terugreis. Jonger dan 2 jaar telt als baby.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-vw-navy">
          Volwassenen
          <input
            type="number"
            min={1}
            max={6}
            value={adjust.adults}
            onChange={(event) => adjust.setAdults(Number(event.target.value))}
            className="mt-1 block h-11 w-full rounded-xl border border-[#e3dccf] bg-white px-3 text-base"
          />
        </label>
        <label className="text-sm font-semibold text-vw-navy">
          Kamers
          <select
            value={adjust.roomCount}
            onChange={(event) => adjust.setRoomCount(Number(event.target.value))}
            className="mt-1 block h-11 w-full rounded-xl border border-[#e3dccf] bg-white px-3 text-base"
          >
            <option value={1}>1 kamer</option>
            <option value={2}>2 kamers</option>
          </select>
        </label>
        {showDate ? (
          <label className="text-sm font-semibold text-vw-navy">
            Vertrekdatum
            <input
              type="date"
              min={minDate}
              value={adjust.tripDate}
              onChange={(event) => adjust.setTripDate(event.target.value)}
              className="mt-1 block h-11 w-full rounded-xl border border-[#e3dccf] bg-white px-3 text-base"
            />
          </label>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-vw-navy">Kinderen</p>
          <button
            type="button"
            onClick={adjust.addChild}
            className="text-sm font-semibold text-vw-navy"
          >
            Kind toevoegen
          </button>
        </div>
        {adjust.childAges.length === 0 ? (
          <p className="mt-2 text-[13px] text-vw-muted">Geen kinderen</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {adjust.childAges.map((age, index) => (
              <li key={`child-${index}`} className="flex items-center gap-2">
                <label className="min-w-0 flex-1 text-[13px] text-vw-muted">
                  Leeftijd kind {index + 1}
                  <select
                    value={age}
                    aria-label={`Leeftijd kind ${index + 1}`}
                    onChange={(event) => adjust.setChildAge(index, Number(event.target.value))}
                    className="mt-1 block h-11 w-full rounded-xl border border-[#e3dccf] bg-white px-3 text-base text-vw-navy"
                  >
                    {Array.from({ length: 18 }, (_, value) => (
                      <option key={value} value={value}>
                        {value} jaar
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => adjust.removeChild(index)} className="mt-5 text-sm font-semibold text-vw-navy">
                  Verwijder
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {adjust.pending ? (
        <p className="mt-4 text-sm font-semibold text-vw-navy" data-testid="detail-price-pending">
          {PENDING_COPY}
        </p>
      ) : null}
    </section>
  );
}

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
