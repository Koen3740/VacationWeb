'use client';

import '@/components/search/departure-period-popup/departure-period-popup.css';
import {
  buildCalendarWeeks,
  flexibilityWindow,
  formatMonthTitle,
  isBetween,
  isSameDay,
  normalizeFlexibilityDays,
  parseIsoDate,
} from '@/components/search/departure-period-popup/departure-period-popup-utils';
import { earliestSelectableDepartureIso } from '@/lib/search/departure-date';
import { Fragment, useMemo, useState } from 'react';

const WEEKDAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/** `single` = one fixed date (+ optional ± band); `range` = from/to period. */
export type CalendarMode = 'single' | 'range';

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 6l-6 6 6 6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6l6 6-6 6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type DeparturePeriodCalendarProps = {
  mode: CalendarMode;
  viewYear: number;
  viewMonth: number;
  startDate: string | null;
  endDate: string | null;
  /** ± margin around the fixed date (single mode only). */
  flexibilityDays?: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (isoDate: string) => void;
  /**
   * Optional controlled hover date, so two side-by-side months (desktop) share one
   * provisional preview across the month boundary. Uncontrolled when omitted.
   */
  hoverDate?: string | null;
  onHoverDateChange?: (isoDate: string | null) => void;
  /** Extra classes for the month navigation buttons (e.g. hide the inner arrows of a 2-month view). */
  prevNavClassName?: string;
  nextNavClassName?: string;
};

function getOrderedRange(startDate: string | null, endDate: string | null) {
  const rangeStart = startDate ? parseIsoDate(startDate) : null;
  const rangeEnd = endDate ? parseIsoDate(endDate) : null;

  if (!rangeStart) {
    return { orderedStart: null, orderedEnd: null };
  }

  if (!rangeEnd) {
    return { orderedStart: rangeStart, orderedEnd: null };
  }

  if (rangeStart <= rangeEnd) {
    return { orderedStart: rangeStart, orderedEnd: rangeEnd };
  }

  return { orderedStart: rangeEnd, orderedEnd: rangeStart };
}

export function DeparturePeriodCalendar({
  mode,
  viewYear,
  viewMonth,
  startDate,
  endDate,
  flexibilityDays = 0,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  hoverDate: hoverDateProp,
  onHoverDateChange,
  prevNavClassName = '',
  nextNavClassName = '',
}: DeparturePeriodCalendarProps) {
  const [localHoverDate, setLocalHoverDate] = useState<string | null>(null);
  const isHoverControlled = hoverDateProp !== undefined;
  const hoverDate = isHoverControlled ? hoverDateProp : localHoverDate;
  const setHoverDate = (next: string | null | ((current: string | null) => string | null)) => {
    const value = typeof next === 'function' ? next(hoverDate) : next;
    if (!isHoverControlled) {
      setLocalHoverDate(value);
    }
    onHoverDateChange?.(value);
  };

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth),
    [viewMonth, viewYear],
  );

  const minSelectableIso = useMemo(() => earliestSelectableDepartureIso(), []);

  const isSingle = mode === 'single';
  const flexDays = isSingle ? normalizeFlexibilityDays(flexibilityDays) : 0;

  const { orderedStart, orderedEnd } = getOrderedRange(startDate, isSingle ? null : endDate);
  const hoverParsed = hoverDate ? parseIsoDate(hoverDate) : null;

  // Single mode: committed ± band around the selected date (ISO strings compare chronologically).
  const committedCenter = isSingle && startDate ? startDate : null;
  const committedBand = committedCenter && flexDays > 0 ? flexibilityWindow(committedCenter, flexDays) : null;
  // Single mode: hover preview of the band the pointer would select (desktop / mouse only).
  const previewCenter = isSingle && hoverDate && hoverDate !== committedCenter ? hoverDate : null;
  const previewBand = previewCenter ? flexibilityWindow(previewCenter, flexDays) : null;

  // Range mode: preview from the first chosen day to the hovered day.
  const previewStart = !isSingle && orderedStart && !orderedEnd && hoverParsed
    ? (hoverParsed < orderedStart ? hoverParsed : orderedStart)
    : null;
  const previewEnd = !isSingle && orderedStart && !orderedEnd && hoverParsed
    ? (hoverParsed < orderedStart ? orderedStart : hoverParsed)
    : null;

  return (
    <div className="departure-period-calendar" onPointerLeave={() => setHoverDate(null)}>
      <div className="departure-period-calendar__header">
        <button
          type="button"
          onClick={onPrevMonth}
          className={`departure-period-calendar__nav ${prevNavClassName}`}
          aria-label="Vorige maand"
        >
          <ChevronLeftIcon />
        </button>
        <h3 className="departure-period-calendar__title">
          {formatMonthTitle(viewYear, viewMonth)}
        </h3>
        <button
          type="button"
          onClick={onNextMonth}
          className={`departure-period-calendar__nav ${nextNavClassName}`}
          aria-label="Volgende maand"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="departure-period-calendar__grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="departure-period-calendar__weekday">
            {label}
          </div>
        ))}

        {weeks.map((week) => (
          <Fragment key={`week-${week.weekNumber}-${week.days[0].isoDate}`}>
            {week.days.map((day) => {
              const dayDate = day.date;
              const iso = day.isoDate;

              // Days of the neighbouring months stay empty (as in the prototype); with two months
              // side by side they would otherwise appear twice.
              if (!day.isCurrentMonth) {
                return <div key={iso} className="departure-period-calendar__day-cell" aria-hidden="true" />;
              }
              const isDisabled = iso < minSelectableIso;

              const classNames = ['departure-period-calendar__day'];
              const cellClassNames = ['departure-period-calendar__day-cell'];

              if (isDisabled) {
                classNames.push('departure-period-calendar__day--disabled');
              } else {
                classNames.push('departure-period-calendar__day--default');
              }

              let isBoundary = false;

              if (isSingle) {
                const inPreview = !isDisabled && previewBand
                  ? iso >= previewBand.start && iso <= previewBand.end
                  : false;
                const inCommitted = !isDisabled && committedBand
                  ? iso >= committedBand.start && iso <= committedBand.end
                  : false;
                const isCommittedCenter = !isDisabled && iso === committedCenter;
                const isPreviewCenter = !isDisabled && iso === previewCenter;

                // A band that crosses a month boundary is rounded off at the month edge.
                const isMonthFirst = dayDate.getDate() === 1;
                const isMonthLast = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1).getDate() === 1;

                if (inPreview && previewBand && flexDays > 0) {
                  cellClassNames.push('departure-period-calendar__day-cell--flex-preview');
                  if (iso === previewBand.start || isMonthFirst) cellClassNames.push('departure-period-calendar__day-cell--band-start');
                  if (iso === previewBand.end || isMonthLast) cellClassNames.push('departure-period-calendar__day-cell--band-end');
                } else if (inCommitted && committedBand) {
                  cellClassNames.push('departure-period-calendar__day-cell--flex-band');
                  if (iso === committedBand.start || isMonthFirst) cellClassNames.push('departure-period-calendar__day-cell--band-start');
                  if (iso === committedBand.end || isMonthLast) cellClassNames.push('departure-period-calendar__day-cell--band-end');
                }

                if (isCommittedCenter) {
                  classNames.push('departure-period-calendar__day--selected');
                  isBoundary = true;
                } else if (isPreviewCenter) {
                  classNames.push('departure-period-calendar__day--preview-center');
                  isBoundary = true;
                } else if (inPreview && flexDays > 0) {
                  classNames.push('departure-period-calendar__day--flex-preview');
                } else if (inCommitted) {
                  classNames.push('departure-period-calendar__day--flex-member');
                }
              } else {
                const isStart = !isDisabled && orderedStart ? isSameDay(dayDate, orderedStart) : false;
                const isEnd = !isDisabled && orderedEnd ? isSameDay(dayDate, orderedEnd) : false;
                const inRange = !isDisabled && orderedStart && orderedEnd
                  ? isBetween(dayDate, orderedStart, orderedEnd)
                  : false;

                const isPreviewStart = !isDisabled && previewStart ? isSameDay(dayDate, previewStart) : false;
                const isPreviewEnd = !isDisabled && previewEnd ? isSameDay(dayDate, previewEnd) : false;
                const inPreviewRange = !isDisabled && previewStart && previewEnd
                  ? isBetween(dayDate, previewStart, previewEnd)
                  : false;
                const usePreview = !orderedEnd && previewStart && previewEnd;

                // Continuous period band on the cell (same look as the ± band), rounded at the ends
                // and at month edges.
                const isMonthFirstRange = dayDate.getDate() === 1;
                const isMonthLastRange = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1).getDate() === 1;
                const bandCell = (kind: 'flex-band' | 'flex-preview', isBandStart: boolean, isBandEnd: boolean) => {
                  cellClassNames.push(`departure-period-calendar__day-cell--${kind}`);
                  if (isBandStart || isMonthFirstRange) cellClassNames.push('departure-period-calendar__day-cell--band-start');
                  if (isBandEnd || isMonthLastRange) cellClassNames.push('departure-period-calendar__day-cell--band-end');
                };
                if (!isDisabled && usePreview && (inPreviewRange || isPreviewStart || isPreviewEnd) && !(isPreviewStart && isPreviewEnd)) {
                  bandCell('flex-preview', isPreviewStart, isPreviewEnd);
                } else if (!isDisabled && !usePreview && orderedEnd && (inRange || isStart || isEnd) && !(isStart && isEnd)) {
                  bandCell('flex-band', isStart, isEnd);
                }

                if (!isDisabled && usePreview) {
                  if (isPreviewStart) classNames.push('departure-period-calendar__day--preview-start');
                  if (isPreviewEnd) classNames.push('departure-period-calendar__day--preview-end');
                  if (inPreviewRange) classNames.push('departure-period-calendar__day--preview-range');
                  if (isPreviewStart || isPreviewEnd) {
                    // Committed first day stays filled; the hovered (provisional) last day gets a ring.
                    const isCommittedStart = orderedStart ? isSameDay(dayDate, orderedStart) : false;
                    classNames.push(
                      hoverDate === iso && !isCommittedStart
                        ? 'departure-period-calendar__day--preview-center'
                        : 'departure-period-calendar__day--preview-selected',
                    );
                  }
                } else if (!isDisabled) {
                  if (isStart) classNames.push('departure-period-calendar__day--range-start');
                  if (isEnd) classNames.push('departure-period-calendar__day--range-end');
                  if (inRange) classNames.push('departure-period-calendar__day--in-range');
                  if (isStart || isEnd) classNames.push('departure-period-calendar__day--selected');
                }

                isBoundary = isStart || isEnd || isPreviewStart || isPreviewEnd;
              }

              const isHovered = !isDisabled && hoverDate === iso;
              if (isHovered && !isBoundary) {
                classNames.push('departure-period-calendar__day--hover');
              }

              return (
                <div key={iso} className={cellClassNames.join(' ')}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    aria-pressed={isSingle && !isDisabled && iso === committedCenter ? true : undefined}
                    data-date={iso}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isDisabled) {
                        return;
                      }
                      // Touch: no hover dependency; after a tap the committed band is shown.
                      setHoverDate(null);
                      onSelectDate(iso);
                    }}
                    onPointerEnter={(event) => {
                      // Hover preview only for a real mouse pointer (touch taps must not leave a sticky preview).
                      if (!isDisabled && event.pointerType === 'mouse') {
                        setHoverDate(iso);
                      }
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType === 'mouse') {
                        setHoverDate((current) => (current === iso ? null : current));
                      }
                    }}
                    className={classNames.join(' ')}
                  >
                    {day.date.getDate()}
                  </button>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
