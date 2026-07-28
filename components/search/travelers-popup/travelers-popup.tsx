'use client';

import '@/components/search/travelers-popup/travelers-popup.css';
import {
  MAX_TOTAL_TRAVELERS,
  addRoom,
  canDecreaseField,
  canIncreaseField,
  canShowAddRoomButton,
  createDefaultRoom,
  decreaseRoomField,
  getTotalTravelers,
  increaseRoomField,
  removeRoom,
  type RoomTravelers,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
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

function BedIcon() {
  return (
    <svg
      className="travelers-popup__room-tab-icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 4v16M2 8h20v12M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2M6 12h4M14 12h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CounterRow({
  label,
  subtext,
  value,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  subtext: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="travelers-popup__row">
      <div>
        <div className="travelers-popup__row-label">{label}</div>
        <div className="travelers-popup__row-subtext">{subtext}</div>
      </div>
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

function TravelersPopupPanel({
  travelers,
  activeRoomIndex,
  onActiveRoomIndexChange,
  onClose,
  onChange,
}: {
  travelers: TravelersState;
  activeRoomIndex: number;
  onActiveRoomIndexChange: (index: number) => void;
  onClose: () => void;
  onChange: (travelers: TravelersState) => void;
}) {
  const [showLimitNotice, setShowLimitNotice] = useState(false);
  const activeRoom = travelers.rooms[activeRoomIndex] ?? createDefaultRoom();
  const totalTravelers = getTotalTravelers(travelers.rooms);
  const isTotalFull = totalTravelers >= MAX_TOTAL_TRAVELERS;
  const canAddAnotherRoom = canShowAddRoomButton(travelers);

  const handleAddRoom = () => {
    const nextState = addRoom(travelers);
    if (nextState.rooms.length === travelers.rooms.length) {
      setShowLimitNotice(true);
      return;
    }

    setShowLimitNotice(false);
    onChange(nextState);
    onActiveRoomIndexChange(nextState.rooms.length - 1);
  };

  const handleRemoveRoom = () => {
    if (travelers.rooms.length <= 1) {
      return;
    }

    const nextState = removeRoom(travelers, activeRoomIndex);
    onChange(nextState);
    setShowLimitNotice(false);
    onActiveRoomIndexChange(Math.min(activeRoomIndex, nextState.rooms.length - 1));
  };

  const handleIncrease = (field: keyof RoomTravelers) => {
    setShowLimitNotice(false);
    onChange(increaseRoomField(travelers, activeRoomIndex, field));
  };

  const handleDecrease = (field: keyof RoomTravelers) => {
    setShowLimitNotice(false);
    onChange(decreaseRoomField(travelers, activeRoomIndex, field));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="travelers-popup-title"
      className={`w-[400px] overflow-hidden rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ${destinationPopupPoppins.className}`}
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

      <div className="travelers-popup__top-bar">
        <div className="travelers-popup__tabs" role="tablist" aria-label="Kamers">
          {travelers.rooms.map((_, index) => (
            <button
              key={`room-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={activeRoomIndex === index}
              aria-label={`Kamer ${index + 1}`}
              onClick={() => onActiveRoomIndexChange(index)}
              className={`travelers-popup__room-tab ${
                activeRoomIndex === index ? 'travelers-popup__room-tab--active' : ''
              }`}
            >
              <BedIcon />
              <span className="travelers-popup__room-tab-number">{index + 1}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleAddRoom();
            }}
            disabled={!canAddAnotherRoom}
            className="travelers-popup__add-room"
            aria-label="Kamer toevoegen"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <h3 className="travelers-popup__section-title">Op deze kamer</h3>

      <div className="travelers-popup__rows">
        <CounterRow
          label="Volwassenen"
          subtext="Vanaf 12 jaar"
          value={activeRoom.adults}
          canDecrease={canDecreaseField(activeRoom, 'adults')}
          canIncrease={canIncreaseField(travelers, activeRoomIndex, 'adults')}
          onDecrease={() => handleDecrease('adults')}
          onIncrease={() => handleIncrease('adults')}
        />
        <CounterRow
          label="Kinderen"
          subtext="2 t/m 11 jaar"
          value={activeRoom.children}
          canDecrease={canDecreaseField(activeRoom, 'children')}
          canIncrease={canIncreaseField(travelers, activeRoomIndex, 'children')}
          onDecrease={() => handleDecrease('children')}
          onIncrease={() => handleIncrease('children')}
        />
        <CounterRow
          label="Baby's"
          subtext="Jonger dan 2 jaar"
          value={activeRoom.babies}
          canDecrease={canDecreaseField(activeRoom, 'babies')}
          canIncrease={canIncreaseField(travelers, activeRoomIndex, 'babies')}
          onDecrease={() => handleDecrease('babies')}
          onIncrease={() => handleIncrease('babies')}
        />
      </div>

      {isTotalFull || showLimitNotice ? (
        <p className="travelers-popup__max-notice" role="status">
          Maximum {MAX_TOTAL_TRAVELERS} reizigers bereikt.
        </p>
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleRemoveRoom();
        }}
        disabled={travelers.rooms.length <= 1}
        className="travelers-popup__remove-room"
      >
        Kamer verwijderen
      </button>
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
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setActiveRoomIndex((current) => Math.min(current, travelers.rooms.length - 1));
    }
  }, [open, travelers.rooms.length]);

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

  if (!open) {
    return null;
  }

  if (!mounted) {
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
        <TravelersPopupPanel
          travelers={travelers}
          activeRoomIndex={activeRoomIndex}
          onActiveRoomIndexChange={setActiveRoomIndex}
          onClose={onClose}
          onChange={onChange}
        />
      </div>
    </div>,
    document.body,
  );
}
