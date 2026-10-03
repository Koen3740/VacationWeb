'use client';

import '@/components/search/travelers-popup/travelers-popup.css';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import {
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  MAX_TOTAL_TRAVELERS,
  addChild,
  assignTravellerRoom,
  canDecreaseAdults,
  canDecreaseChildren,
  canDecreaseRooms,
  canIncreaseRooms,
  canIncreaseTravelers,
  getTotalTravelers,
  isTravelersStateComplete,
  normalizeTravelersState,
  removeChild,
  setAdultCount,
  setChildAge,
  setRoomCount,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TravelersPopupProps = {
  open: boolean;
  travelers: TravelersState;
  onClose: () => void;
  onChange: (travelers: TravelersState) => void;
};

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Stepper({
  label,
  value,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="travelers-popup__row">
      <div className="travelers-popup__row-label">{label}</div>
      <div className="travelers-popup__stepper">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDecrease();
          }}
          disabled={!canDecrease}
          className="travelers-popup__stepper-button"
          aria-label={`Minder ${label.toLowerCase()}`}
        >
          <MinusIcon />
        </button>
        <span className="travelers-popup__stepper-value">{value}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIncrease();
          }}
          disabled={!canIncrease}
          className="travelers-popup__stepper-button"
          aria-label={`Meer ${label.toLowerCase()}`}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

const CHILD_AGE_OPTIONS = Array.from(
  { length: CHILD_AGE_MAX - CHILD_AGE_MIN + 1 },
  (_, index) => CHILD_AGE_MIN + index,
);

function ChildAgeSelect({
  childIndex,
  age,
  onChange,
}: {
  childIndex: number;
  age: number | null;
  onChange: (age: number | null) => void;
}) {
  return (
    <select
      value={age === null ? '' : String(age)}
      onChange={(event) => {
        const value = event.target.value;
        onChange(value === '' ? null : Number(value));
      }}
      className="travelers-popup__select"
      aria-label={`Leeftijd kind ${childIndex + 1}`}
    >
      <option value="">Leeftijd</option>
      {CHILD_AGE_OPTIONS.map((value) => (
        <option key={value} value={String(value)}>
          {value === 1 ? '1 jaar' : `${value} jaar`}
        </option>
      ))}
    </select>
  );
}

function personLabel(state: TravelersState, personIndex: number): string {
  return personIndex < state.adults
    ? `Volwassene ${personIndex + 1}`
    : `Kind ${personIndex - state.adults + 1}`;
}

function TravelersPopupPanel({
  travelers,
  onClose,
  onChange,
}: {
  travelers: TravelersState;
  onClose: () => void;
  onChange: (travelers: TravelersState) => void;
}) {
  const state = normalizeTravelersState(travelers);
  const totalTravelers = getTotalTravelers(state);
  const isTotalFull = totalTravelers >= MAX_TOTAL_TRAVELERS;
  const incomplete = !isTravelersStateComplete(state);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="travelers-popup-title"
      className={`travelers-popup__dialog ${destinationPopupPoppins.className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="travelers-popup-title" className="text-base font-semibold text-[#1E40AF]">
          Reisgezelschap
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center"
          aria-label="Sluiten"
        >
          <CloseIcon />
        </button>
      </div>

      <Stepper
        label="Volwassenen"
        value={state.adults}
        canDecrease={canDecreaseAdults(state)}
        canIncrease={canIncreaseTravelers(state)}
        onDecrease={() => onChange(setAdultCount(state, state.adults - 1))}
        onIncrease={() => onChange(setAdultCount(state, state.adults + 1))}
      />

      <Stepper
        label="Kinderen"
        value={state.childAges.length}
        canDecrease={canDecreaseChildren(state)}
        canIncrease={canIncreaseTravelers(state)}
        onDecrease={() => onChange(removeChild(state, state.childAges.length - 1))}
        onIncrease={() => onChange(addChild(state))}
      />

      {state.childAges.length > 0 ? (
        <div className="travelers-popup__travellers">
          {state.childAges.map((age, index) => (
            <section key={index} className="travelers-popup__traveller">
              <div className="travelers-popup__traveller-header">
                <h3 className="travelers-popup__section-title">Kind {index + 1}</h3>
                <button
                  type="button"
                  className="travelers-popup__remove-traveller"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(removeChild(state, index));
                  }}
                >
                  Verwijderen
                </button>
              </div>
              <ChildAgeSelect
                childIndex={index}
                age={age}
                onChange={(next) => onChange(setChildAge(state, index, next))}
              />
            </section>
          ))}
          <p className="travelers-popup__dob-hint">Leeftijd op de terugreisdatum.</p>
          {incomplete ? (
            <p className="travelers-popup__dob-error">Kies de leeftijd van elk kind.</p>
          ) : null}
        </div>
      ) : null}

      <div className="travelers-popup__rooms-block">
        <Stepper
          label="Aantal kamers"
          value={state.roomCount}
          canDecrease={canDecreaseRooms(state)}
          canIncrease={canIncreaseRooms(state)}
          onDecrease={() => onChange(setRoomCount(state, state.roomCount - 1))}
          onIncrease={() => onChange(setRoomCount(state, state.roomCount + 1))}
        />
        {state.roomCount === 1 ? (
          <p className="travelers-popup__dob-hint">Alle reizigers zitten in kamer 1.</p>
        ) : (
          <>
            {Array.from({ length: totalTravelers }, (_, personIndex) => (
              <label key={personIndex} className="travelers-popup__room-assign">
                <span>{personLabel(state, personIndex)}</span>
                <select
                  className="travelers-popup__select"
                  value={String((state.roomAssignments[personIndex] ?? 0) + 1)}
                  onChange={(event) => {
                    onChange(assignTravellerRoom(state, personIndex, Number(event.target.value) - 1));
                  }}
                >
                  {Array.from({ length: state.roomCount }, (_, roomIndex) => (
                    <option key={roomIndex} value={String(roomIndex + 1)}>
                      Kamer {roomIndex + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="travelers-popup__room-summary" aria-label="Kamerindeling">
              {Array.from({ length: state.roomCount }, (_, roomIndex) => {
                const names = Array.from({ length: totalTravelers }, (_, personIndex) =>
                  state.roomAssignments[personIndex] === roomIndex
                    ? personLabel(state, personIndex)
                    : null,
                ).filter((value): value is string => Boolean(value));
                return (
                  <p key={roomIndex} className="travelers-popup__room-summary-row">
                    <strong>Kamer {roomIndex + 1}:</strong>{' '}
                    {names.length > 0 ? names.join(', ') : 'nog niemand'}
                  </p>
                );
              })}
            </div>
          </>
        )}
      </div>

      {isTotalFull ? (
        <p className="travelers-popup__max-notice" role="status">
          Maximum {MAX_TOTAL_TRAVELERS} reizigers bereikt.
        </p>
      ) : null}
    </div>
  );
}
export function TravelersPopup({
  open,
  travelers,
  onClose,
  onChange,
}: TravelersPopupProps) {
  const [mounted, setMounted] = useState(false);
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      overlayReadyRef.current = false;
      return undefined;
    }

    overlayReadyRef.current = false;
    const overlayTimer = window.setTimeout(() => {
      overlayReadyRef.current = true;
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(overlayTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${destinationPopupPoppins.className}`}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit reisgezelschap-popup"
        onClick={() => {
          if (overlayReadyRef.current) {
            onClose();
          }
        }}
      />
      <div className="relative z-10" onClick={(event) => event.stopPropagation()}>
        <TravelersPopupPanel travelers={travelers} onClose={onClose} onChange={onChange} />
      </div>
    </div>,
    document.body,
  );
}
