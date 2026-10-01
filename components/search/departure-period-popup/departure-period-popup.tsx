'use client';

import { DeparturePeriodCalendar } from '@/components/search/departure-period-popup/departure-period-calendar';
import '@/components/search/departure-period-popup/departure-period-popup.css';
import {
  FLEXIBILITY_DAY_VALUES,
  flexibilityForSelection,
  isDeparturePeriod,
  parseIsoDate,
  selectFixedDepartureDate,
  selectPeriodDepartureDate,
  type FlexibilityDays,
} from '@/components/search/departure-period-popup/departure-period-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { isSelectableDepartureIso } from '@/lib/search/departure-date';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type { FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup-utils';

/** `vast` = one fixed departure date (+ optional ± margin); `periode` = from/to without margin. */
export type TabId = 'vast' | 'periode';

const FLEXIBILITY_LABELS: Record<FlexibilityDays, string> = {
  0: 'Exacte datum',
  1: '± 1 dag',
  2: '± 2 dagen',
  3: '± 3 dagen',
};

export type DeparturePeriodPopupProps = {
  open: boolean;
  startDate: string | null;
  endDate: string | null;
  flexibilityDays?: FlexibilityDays;
  onClose: () => void;
  /**
   * Called on every committed change. `flexibilityDays` is always passed explicitly
   * (0 for a period) so a previous ± margin can never stay active on a period.
   */
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
  fixedDate,
  periodStart,
  periodEnd,
  flexibilityDays,
  viewYear,
  viewMonth,
  hoverDate,
  onHoverDateChange,
  onClose,
  onTabChange,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onFlexibilityChange,
  onClear,
  showClose = true,
}: {
  activeTab: TabId;
  fixedDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  flexibilityDays: FlexibilityDays;
  viewYear: number;
  viewMonth: number;
  hoverDate: string | null;
  onHoverDateChange: (isoDate: string | null) => void;
  onClose?: () => void;
  onTabChange: (tab: TabId) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (isoDate: string) => void;
  onFlexibilityChange: (days: FlexibilityDays) => void;
  onClear: () => void;
  showClose?: boolean;
}) {
  const isFixed = activeTab === 'vast';
  const hasSelection = isFixed ? Boolean(fixedDate) : Boolean(periodStart);
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const calendarProps = {
    mode: (isFixed ? 'single' : 'range') as 'single' | 'range',
    startDate: isFixed ? fixedDate : periodStart,
    endDate: isFixed ? null : periodEnd,
    flexibilityDays: isFixed ? flexibilityDays : 0,
    onPrevMonth,
    onNextMonth,
    onSelectDate,
    hoverDate,
    onHoverDateChange,
  };

  return (
    <div
      role="dialog"
      aria-modal={showClose}
      aria-labelledby="departure-period-popup-title"
      data-testid="departure-period-popup"
      className={`departure-period-popup flex max-h-[100dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-4 pt-4 shadow-[0_12px_32px_rgba(0,0,0,0.25)] sm:max-h-[calc(100dvh-2rem)] sm:w-[440px] sm:rounded-2xl sm:px-6 sm:pt-5 md:w-[720px] md:px-[26px] md:pt-[22px] ${destinationPopupPoppins.className}`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <h2 id="departure-period-popup-title" className="text-base font-semibold text-[#1E40AF]">
          Wanneer wil je vertrekken?
        </h2>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F1F5F9]"
            aria-label="Sluiten"
          >
            <CloseIcon />
          </button>
        ) : (
          <div className="h-10 w-10" aria-hidden="true" />
        )}
      </div>

      <div className="departure-period-popup__tabs" role="tablist" aria-label="Soort vertrek">
        {(
          [
            ['vast', 'Vaste vertrekdatum', '1 dag, evt. ± marge'],
            ['periode', 'Vertrekperiode', 'van – tot'],
          ] as const
        ).map(([tab, label, sub]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`departure-period-popup__tab ${activeTab === tab ? 'departure-period-popup__tab--active' : ''}`}
          >
            {label}
            <small>{sub}</small>
          </button>
        ))}
      </div>

      {isFixed ? (
        <>
          <div
            className="departure-period-popup__flexibility"
            role="group"
            aria-label="Marge rond je vertrekdatum"
          >
            <span className="departure-period-popup__flexibility-label" aria-hidden="true">Marge:</span>
            {FLEXIBILITY_DAY_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={flexibilityDays === value}
                onClick={(event) => {
                  event.stopPropagation();
                  onFlexibilityChange(value);
                }}
                className={`departure-period-popup__flexibility-option ${
                  flexibilityDays === value ? 'departure-period-popup__flexibility-option--active' : ''
                }`}
              >
                {FLEXIBILITY_LABELS[value]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Mobile / small: one month. Desktop (md+): two months side by side, as in the prototype. */}
      <div role="tabpanel" aria-label={isFixed ? 'Vaste vertrekdatum' : 'Vertrekperiode'} className="flex shrink-0 gap-7">
        <div className="min-w-0 flex-1">
          <DeparturePeriodCalendar
            {...calendarProps}
            viewYear={viewYear}
            viewMonth={viewMonth}
            nextNavClassName="md:invisible"
          />
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <DeparturePeriodCalendar
            {...calendarProps}
            viewYear={nextYear}
            viewMonth={nextMonth}
            prevNavClassName="invisible"
          />
        </div>
      </div>

      <div className="departure-period-popup__footer-bar">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasSelection}
          className="text-[13px] font-medium text-[#1E40AF] underline underline-offset-2 disabled:cursor-default disabled:text-[#94A3B8] disabled:no-underline"
        >
          Wissen
        </button>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="h-11 min-w-[140px] rounded-md bg-[#2E7D32] px-7 text-sm font-semibold text-white"
          >
            OPSLAAN
          </button>
        ) : null}
      </div>
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
  const [activeTab, setActiveTab] = useState<TabId>('vast');
  const [viewYear, setViewYear] = useState(2024);
  const [viewMonth, setViewMonth] = useState(6);
  const [fixedDate, setFixedDate] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [flexibilityDays, setFlexibilityDays] = useState<FlexibilityDays>(flexibilityDaysProp);
  // Shared provisional hover date for both visible months (desktop mouse only).
  const [hoverDate, setHoverDate] = useState<string | null>(null);
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
      const isPeriod = isDeparturePeriod(startDate, endDate);
      setActiveTab(isPeriod ? 'periode' : 'vast');
      setFixedDate(isPeriod ? null : startDate);
      setPeriodStart(isPeriod ? startDate : null);
      setPeriodEnd(isPeriod ? endDate : null);
      setFlexibilityDays(isPeriod ? 0 : flexibilityDaysProp);
      setHoverDate(null);

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

  const emitFixed = (date: string | null, days: FlexibilityDays) => {
    onChange(date, null, flexibilityForSelection(date, null, days));
  };

  const emitPeriod = (start: string | null, end: string | null) => {
    // A period never carries a ± margin (Search Architecture v2.13).
    onChange(start, end, 0);
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) {
      return;
    }
    setActiveTab(tab);
    setHoverDate(null);
    onTabChange?.(tab);

    if (tab === 'vast') {
      emitFixed(fixedDate, flexibilityDays);
    } else {
      emitPeriod(periodStart, periodEnd);
    }
  };

  const handleSelectDate = (isoDate: string) => {
    if (!isSelectableDepartureIso(isoDate)) {
      return;
    }

    if (activeTab === 'vast') {
      const next = selectFixedDepartureDate(isoDate);
      setFixedDate(next.start);
      emitFixed(next.start, flexibilityDays);
      return;
    }

    const next = selectPeriodDepartureDate({ start: periodStart, end: periodEnd }, isoDate);
    setPeriodStart(next.start);
    setPeriodEnd(next.end);
    emitPeriod(next.start, next.end);
  };

  const handleFlexibilityChange = (days: FlexibilityDays) => {
    setFlexibilityDays(days);
    emitFixed(fixedDate, days);
  };

  const handleClear = () => {
    if (activeTab === 'vast') {
      setFixedDate(null);
      emitFixed(null, flexibilityDays);
      return;
    }
    setPeriodStart(null);
    setPeriodEnd(null);
    emitPeriod(null, null);
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
      fixedDate={fixedDate}
      periodStart={periodStart}
      periodEnd={periodEnd}
      flexibilityDays={flexibilityDays}
      viewYear={viewYear}
      viewMonth={viewMonth}
      hoverDate={hoverDate}
      onHoverDateChange={setHoverDate}
      onClose={onClose}
      onTabChange={handleTabChange}
      onPrevMonth={goToPrevMonth}
      onNextMonth={goToNextMonth}
      onSelectDate={handleSelectDate}
      onFlexibilityChange={handleFlexibilityChange}
      onClear={handleClear}
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

  // Mobile: bottom sheet (full width, max 100dvh, scrolls internally, sticky footer).
  // sm: centred dialog with one month; md+: 720px dialog with two months side by side.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 ${destinationPopupPoppins.className}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit vertrekperiode-popup"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[100dvh] w-full justify-center sm:max-h-[calc(100dvh-2rem)] sm:w-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {panel}
      </div>
    </div>,
    document.body,
  );
}
