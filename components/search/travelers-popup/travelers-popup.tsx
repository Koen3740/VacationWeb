'use client';

import '@/components/search/travelers-popup/travelers-popup.css';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import {
  MAX_TOTAL_TRAVELERS,
  addTraveller,
  assignTravellerRoom,
  calendarDateFromParts,
  canDecreaseRooms,
  canDecreaseTravelers,
  canIncreaseRooms,
  canIncreaseTravelers,
  derivedAgeYears,
  getTotalTravelers,
  isValidIsoDateOfBirth,
  normalizeTravelersState,
  removeTraveller,
  setRoomCount,
  setTravellerCount,
  setTravellerDateOfBirth,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TravelersPopupProps = {
  open: boolean;
  travelers: TravelersState;
  onClose: () => void;
  onChange: (travelers: TravelersState) => void;
};

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

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

function parseDobParts(iso: string | null): { day: string; month: string; year: string } {
  if (!iso || !isValidIsoDateOfBirth(iso)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = iso.split('-');
  return { day, month, year };
}

function BirthDateFields({
  travellerIndex,
  dateOfBirth,
  onChange,
}: {
  travellerIndex: number;
  dateOfBirth: string | null;
  onChange: (iso: string | null) => void;
}) {
  const initial = parseDobParts(dateOfBirth);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  useEffect(() => {
    if (!dateOfBirth) {
      return;
    }
    const next = parseDobParts(dateOfBirth);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
  }, [dateOfBirth]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1899 }, (_, index) => String(currentYear - index)),
    [currentYear],
  );

  const applyParts = (nextDay: string, nextMonth: string, nextYear: string) => {
    if (!nextDay || !nextMonth || !nextYear) {
      onChange(null);
      return;
    }

    const iso = calendarDateFromParts(Number(nextYear), Number(nextMonth), Number(nextDay));
    onChange(iso);
  };

  const derivedAge = dateOfBirth ? derivedAgeYears(dateOfBirth) : null;
  const incomplete = Boolean(day || month || year) && !(day && month && year);
  const invalidCombo = Boolean(day && month && year) && !dateOfBirth;

  return (
    <div>
      <div className="travelers-popup__dob" role="group" aria-label={`Geboortedatum reiziger ${travellerIndex + 1}`}>
        <label className="travelers-popup__dob-field">
          <span className="travelers-popup__dob-caption">Dag</span>
          <select
            value={day}
            onChange={(event) => {
              const value = event.target.value;
              setDay(value);
              applyParts(value, month, year);
            }}
            className="travelers-popup__select"
          >
            <option value="">Dag</option>
            {Array.from({ length: 31 }, (_, index) => {
              const value = String(index + 1).padStart(2, '0');
              return (
                <option key={value} value={value}>
                  {index + 1}
                </option>
              );
            })}
          </select>
        </label>
        <label className="travelers-popup__dob-field">
          <span className="travelers-popup__dob-caption">Maand</span>
          <select
            value={month}
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value);
              applyParts(day, value, year);
            }}
            className="travelers-popup__select"
          >
            <option value="">Maand</option>
            {MONTHS.map((name, index) => {
              const value = String(index + 1).padStart(2, '0');
              return (
                <option key={value} value={value}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <label className="travelers-popup__dob-field">
          <span className="travelers-popup__dob-caption">Jaar</span>
          <select
            value={year}
            onChange={(event) => {
              const value = event.target.value;
              setYear(value);
              applyParts(day, month, value);
            }}
            className="travelers-popup__select"
          >
            <option value="">Jaar</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {derivedAge !== null ? (
        <p className="travelers-popup__dob-hint">{derivedAge} jaar — afgeleid van de geboortedatum</p>
      ) : null}
      {incomplete ? (
        <p className="travelers-popup__dob-error">Vul een volledige geboortedatum in.</p>
      ) : null}
      {invalidCombo ? (
        <p className="travelers-popup__dob-error">Deze datum is ongeldig of ligt in de toekomst.</p>
      ) : null}
    </div>
  );
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
        label="Aantal reizigers"
        value={totalTravelers}
        canDecrease={canDecreaseTravelers(state)}
        canIncrease={canIncreaseTravelers(state)}
        onDecrease={() => onChange(setTravellerCount(state, totalTravelers - 1))}
        onIncrease={() => onChange(setTravellerCount(state, totalTravelers + 1))}
      />

      <div className="travelers-popup__travellers">
        {state.travellers.map((traveller, index) => (
          <section key={traveller.id} className="travelers-popup__traveller">
            <div className="travelers-popup__traveller-header">
              <h3 className="travelers-popup__section-title">Reiziger {index + 1}</h3>
              {state.travellers.length > 1 ? (
                <button
                  type="button"
                  className="travelers-popup__remove-traveller"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(removeTraveller(state, index));
                  }}
                >
                  Verwijderen
                </button>
              ) : null}
            </div>
            <BirthDateFields
              travellerIndex={index}
              dateOfBirth={traveller.dateOfBirth}
              onChange={(iso) => onChange(setTravellerDateOfBirth(state, index, iso))}
            />
            {state.roomCount > 1 ? (
              <label className="travelers-popup__room-assign">
                <span>Kamer</span>
                <select
                  className="travelers-popup__select"
                  value={String((state.roomAssignments[index] ?? 0) + 1)}
                  onChange={(event) => {
                    onChange(assignTravellerRoom(state, index, Number(event.target.value) - 1));
                  }}
                >
                  {Array.from({ length: state.roomCount }, (_, roomIndex) => (
                    <option key={roomIndex} value={String(roomIndex + 1)}>
                      Kamer {roomIndex + 1}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(addTraveller(state));
        }}
        disabled={!canIncreaseTravelers(state)}
        className="travelers-popup__add-traveller"
      >
        + Reiziger toevoegen
      </button>

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
          <div className="travelers-popup__room-summary" aria-label="Kamerindeling">
            {Array.from({ length: state.roomCount }, (_, roomIndex) => {
              const names = state.travellers
                .map((traveller, index) =>
                  state.roomAssignments[index] === roomIndex ? `Reiziger ${index + 1}` : null,
                )
                .filter((value): value is string => Boolean(value));
              return (
                <p key={roomIndex} className="travelers-popup__room-summary-row">
                  <strong>Kamer {roomIndex + 1}:</strong>{' '}
                  {names.length > 0 ? names.join(', ') : 'nog niemand'}
                </p>
              );
            })}
          </div>
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
