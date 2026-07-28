'use client';

import { DeparturePeriodCalendar } from '@/components/search/departure-period-popup/departure-period-calendar';
import '@/components/search/departure-period-popup/departure-period-popup.css';
import { isSameDay, parseIsoDate } from '@/components/search/departure-period-popup/departure-period-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TabId = 'kalender' | 'flexibel';
export type FlexibilityDays = 0 | 1 | 2;

const FLEXIBILITY_OPTIONS: { value: FlexibilityDays; label: string }[] = [
  { value: 0, label: 'Exacte datum' },
  { value: 1, label: '± 1 dag' },
  { value: 2, label: '± 2 dagen' },
];

export type DeparturePeriodPopupProps = {
  open: boolean;
  startDate: string | null;
  endDate: string | null;
  flexibilityDays?: FlexibilityDays;
  onClose: () => void;
  onChange: (
    startDate: string | null,
    endDate: string | null,
    flexibilityDays?: FlexibilityDays,
  ) => void;
  onTabChange?: (tab: TabId) => void;
  embedded?: boolean;
};

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DeparturePeriodPopupPanel({
  activeTab,
  kalenderStart,
  kalenderEnd,
  flexStart,
  flexEnd,
  flexibilityDays,
  viewYear,
  viewMonth,
  onClose,
  onTabChange,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onFlexibilityChange,
  showClose = true,
}: {
  activeTab: TabId;
  kalenderStart: string | null;
  kalenderEnd: string | null;
  flexStart: string | null;
  flexEnd: string | null;
  flexibilityDays: FlexibilityDays;
  viewYear: number;
  viewMonth: number;
  onClose?: () => void;
  onTabChange: (tab: TabId) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (isoDate: string) => void;
  onFlexibilityChange: (days: FlexibilityDays) => void;
  showClose?: boolean;
}) {
  const isKalender = activeTab === 'kalender';

  return (
    <div
      role="dialog"
      aria-modal={showClose}
      aria-labelledby="departure-period-popup-title"
      className={`w-[560px] overflow-hidden rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ${destinationPopupPoppins.className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="departure-period-popup-title" className="text-base font-semibold text-[#1E40AF]">
          Vertrekperiode
        </h2>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center"
            aria-label="Sluiten"
          >
            <CloseIcon />
          </button>
        ) : (
          <div className="h-6 w-6" aria-hidden="true" />
        )}
      </div>

      <div className="mb-5 flex rounded-full bg-[#1E40AF] p-1" role="tablist" aria-label="Vertrekperiode type">
        <button
          type="button"
          role="tab"
          aria-selected={isKalender}
          onClick={() => onTabChange('kalender')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isKalender
              ? 'bg-white text-[#1f2937]'
              : 'bg-transparent text-white'
          }`}
        >
          Kalender
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isKalender}
          onClick={() => onTabChange('flexibel')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            !isKalender
              ? 'bg-white text-[#1f2937]'
              : 'bg-transparent text-white'
          }`}
        >
          Ik ben flexibel
        </button>
      </div>

      <div role="tabpanel" aria-label={isKalender ? 'Kalender' : 'Ik ben flexibel'}>
        <DeparturePeriodCalendar
          mode={isKalender ? 'kalender' : 'range'}
          viewYear={viewYear}
          viewMonth={viewMonth}
          startDate={isKalender ? kalenderStart : flexStart}
          endDate={isKalender ? kalenderEnd : flexEnd}
          flexibilityDays={isKalender ? flexibilityDays : undefined}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onSelectDate={onSelectDate}
        />
      </div>

      {isKalender ? (
        <div className="departure-period-popup__flexibility" role="group" aria-label="Flexibiliteit rond vertrekdatum">
          {FLEXIBILITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFlexibilityChange(option.value);
              }}
              className={`departure-period-popup__flexibility-option ${
                flexibilityDays === option.value
                  ? 'departure-period-popup__flexibility-option--active'
                  : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="departure-period-popup__footer">
          Selecteer de datums waarbinnen je wil vertrekken.
        </p>
      )}
    </div>
  );
}

export function DeparturePeriodPopup({
  open,
  startDate,
  endDate,
  flexibilityDays: flexibilityDaysProp = 0,
  onClose,
  onChange,
  onTabChange,
  embedded = false,
}: DeparturePeriodPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('kalender');
  const [viewYear, setViewYear] = useState(2024);
  const [viewMonth, setViewMonth] = useState(6);
  const [kalenderStart, setKalenderStart] = useState<string | null>(null);
  const [kalenderEnd, setKalenderEnd] = useState<string | null>(null);
  const [flexStart, setFlexStart] = useState<string | null>(null);
  const [flexEnd, setFlexEnd] = useState<string | null>(null);
  const [flexibilityDays, setFlexibilityDays] = useState<FlexibilityDays>(flexibilityDaysProp);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      setActiveTab('kalender');
      setKalenderStart(startDate);
      setKalenderEnd(endDate);
      setFlexStart(startDate);
      setFlexEnd(endDate);
      setFlexibilityDays(flexibilityDaysProp);

      const initialDate = startDate ?? endDate;
      if (initialDate) {
        const date = parseIsoDate(initialDate);
        setViewYear(date.getFullYear());
        setViewMonth(date.getMonth());
      } else {
        const today = new Date();
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }

      wasOpenRef.current = true;
    }
  }, [endDate, flexibilityDaysProp, open, startDate]);

  useEffect(() => {
    if (!open || embedded) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [embedded, onClose, open]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    onTabChange?.(tab);

    if (tab === 'kalender') {
      onChange(kalenderStart, kalenderEnd, flexibilityDays);
    } else {
      onChange(flexStart, flexEnd, undefined);
    }
  };

  const handleSelectDate = (isoDate: string) => {
    if (activeTab === 'kalender') {
      if (!kalenderStart || (kalenderStart && kalenderEnd)) {
        setKalenderStart(isoDate);
        setKalenderEnd(null);
        onChange(isoDate, null, flexibilityDays);
        return;
      }

      const start = parseIsoDate(kalenderStart);
      const selected = parseIsoDate(isoDate);

      if (selected < start) {
        setKalenderStart(isoDate);
        setKalenderEnd(null);
        onChange(isoDate, null, flexibilityDays);
        return;
      }

      if (isSameDay(selected, start)) {
        setKalenderEnd(null);
        onChange(isoDate, null, flexibilityDays);
        return;
      }

      setKalenderEnd(isoDate);
      onChange(kalenderStart, isoDate, flexibilityDays);
      if (!embedded) {
        window.setTimeout(onClose, 0);
      }
      return;
    }

    if (!flexStart || (flexStart && flexEnd)) {
      setFlexStart(isoDate);
      setFlexEnd(null);
      onChange(isoDate, null, undefined);
      return;
    }

    const start = parseIsoDate(flexStart);
    const selected = parseIsoDate(isoDate);

    if (selected < start) {
      setFlexStart(isoDate);
      setFlexEnd(null);
      onChange(isoDate, null, undefined);
      return;
    }

    setFlexEnd(isoDate);
    onChange(flexStart, isoDate, undefined);
    if (!embedded) {
      window.setTimeout(onClose, 0);
    }
  };

  const handleFlexibilityChange = (days: FlexibilityDays) => {
    setFlexibilityDays(days);
    onChange(kalenderStart, kalenderEnd, days);
    const isSingleDate = kalenderStart && !kalenderEnd;
    if (isSingleDate && !embedded) {
      window.setTimeout(onClose, 0);
    }
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
      return;
    }
    setViewMonth((month) => month - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
      return;
    }
    setViewMonth((month) => month + 1);
  };

  const panel = (
    <DeparturePeriodPopupPanel
      activeTab={activeTab}
      kalenderStart={kalenderStart}
      kalenderEnd={kalenderEnd}
      flexStart={flexStart}
      flexEnd={flexEnd}
      flexibilityDays={flexibilityDays}
      viewYear={viewYear}
      viewMonth={viewMonth}
      onClose={onClose}
      onTabChange={handleTabChange}
      onPrevMonth={goToPrevMonth}
      onNextMonth={goToNextMonth}
      onSelectDate={handleSelectDate}
      onFlexibilityChange={handleFlexibilityChange}
      showClose={!embedded}
    />
  );

  if (!open) {
    return null;
  }

  if (embedded) {
    return panel;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${destinationPopupPoppins.className}`}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit vertrekperiode-popup"
        onClick={onClose}
      />
      <div className="relative z-10" onClick={(event) => event.stopPropagation()}>
        {panel}
      </div>
    </div>,
    document.body,
  );
}
