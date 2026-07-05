'use client';

import '@/components/search/departure-period-popup/departure-period-popup.css';
import {
  addDaysToDate,
  buildCalendarWeeks,
  formatMonthTitle,
  isBetween,
  isSameDay,
  parseIsoDate,
} from '@/components/search/departure-period-popup/departure-period-popup-utils';
import { Fragment, useMemo, useState } from 'react';

const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

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
  flexibilityDays?: 0 | 1 | 2;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (isoDate: string) => void;
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
}: DeparturePeriodCalendarProps) {
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth),
    [viewMonth, viewYear],
  );

  const { orderedStart, orderedEnd } = getOrderedRange(startDate, endDate);
  const hoverParsed = hoverDate ? parseIsoDate(hoverDate) : null;

  const flexWindowStart = mode === 'single' && orderedStart && flexibilityDays > 0
    ? addDaysToDate(orderedStart, -flexibilityDays)
    : null;
  const flexWindowEnd = mode === 'single' && orderedStart && flexibilityDays > 0
    ? addDaysToDate(orderedStart, flexibilityDays)
    : null;

  const previewStart = mode === 'range' && orderedStart && !orderedEnd && hoverParsed
    ? (hoverParsed < orderedStart ? hoverParsed : orderedStart)
    : null;
  const previewEnd = mode === 'range' && orderedStart && !orderedEnd && hoverParsed
    ? (hoverParsed < orderedStart ? orderedStart : hoverParsed)
    : null;

  return (
    <div className="departure-period-calendar">
      <div className="departure-period-calendar__header">
        <button
          type="button"
          onClick={onPrevMonth}
          className="departure-period-calendar__nav"
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
          className="departure-period-calendar__nav"
          aria-label="Volgende maand"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="departure-period-calendar__grid">
        <div className="departure-period-calendar__wk-label">Wk</div>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="departure-period-calendar__weekday">
            {label}
          </div>
        ))}

        {weeks.map((week) => (
          <Fragment key={`week-${week.weekNumber}-${week.days[0].isoDate}`}>
            <div className="departure-period-calendar__week-number">
              {week.weekNumber}
            </div>
            {week.days.map((day) => {
              const dayDate = day.date;

              const isCenter = mode === 'single' && orderedStart
                ? isSameDay(dayDate, orderedStart)
                : false;

              const inFlexBuffer = mode === 'single' && flexWindowStart && flexWindowEnd && orderedStart
                ? isBetween(dayDate, flexWindowStart, flexWindowEnd)
                : false;

              const isFlexStart = mode === 'single' && flexWindowStart
                ? isSameDay(dayDate, flexWindowStart) && !isCenter
                : false;
              const isFlexEnd = mode === 'single' && flexWindowEnd
                ? isSameDay(dayDate, flexWindowEnd) && !isCenter
                : false;

              const isStart = mode === 'range' && orderedStart
                ? isSameDay(dayDate, orderedStart)
                : false;
              const isEnd = mode === 'range' && orderedEnd
                ? isSameDay(dayDate, orderedEnd)
                : false;
              const inRange = mode === 'range' && orderedStart && orderedEnd
                ? isBetween(dayDate, orderedStart, orderedEnd)
                : false;

              const isPreviewStart = previewStart ? isSameDay(dayDate, previewStart) : false;
              const isPreviewEnd = previewEnd ? isSameDay(dayDate, previewEnd) : false;
              const inPreviewRange = previewStart && previewEnd
                ? isBetween(dayDate, previewStart, previewEnd)
                : false;

              const isHovered = hoverDate === day.isoDate;
              const usePreview = mode === 'range' && !orderedEnd && previewStart && previewEnd;

              const classNames = ['departure-period-calendar__day'];

              if (!day.isCurrentMonth) {
                classNames.push('departure-period-calendar__day--outside');
              } else {
                classNames.push('departure-period-calendar__day--default');
              }

              if (mode === 'single') {
                if (isFlexStart) {
                  classNames.push('departure-period-calendar__day--range-start');
                }
                if (isFlexEnd) {
                  classNames.push('departure-period-calendar__day--range-end');
                }
                if (inFlexBuffer) {
                  classNames.push('departure-period-calendar__day--in-range');
                }
                if (isCenter) {
                  classNames.push('departure-period-calendar__day--selected');
                }
              } else if (usePreview) {
                if (isPreviewStart) {
                  classNames.push('departure-period-calendar__day--preview-start');
                }
                if (isPreviewEnd) {
                  classNames.push('departure-period-calendar__day--preview-end');
                }
                if (inPreviewRange) {
                  classNames.push('departure-period-calendar__day--preview-range');
                }
                if (isPreviewStart || isPreviewEnd) {
                  classNames.push('departure-period-calendar__day--preview-selected');
                }
              } else {
                if (isStart) {
                  classNames.push('departure-period-calendar__day--range-start');
                }
                if (isEnd) {
                  classNames.push('departure-period-calendar__day--range-end');
                }
                if (inRange) {
                  classNames.push('departure-period-calendar__day--in-range');
                }
                if (isStart || isEnd) {
                  classNames.push('departure-period-calendar__day--selected');
                }
              }

              const isBoundary = isCenter || isStart || isEnd || isPreviewStart || isPreviewEnd;
              if (isHovered && !isBoundary) {
                classNames.push('departure-period-calendar__day--hover');
              }

              return (
                <div key={day.isoDate} className="departure-period-calendar__day-cell">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectDate(day.isoDate);
                    }}
                    onMouseEnter={() => setHoverDate(day.isoDate)}
                    onMouseLeave={() => setHoverDate(null)}
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
