export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isBetween(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time > start.getTime() && time < end.getTime();
}

export function isOnOrBetween(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export type CalendarDay = {
  date: Date;
  isoDate: string;
  isCurrentMonth: boolean;
};

export type CalendarWeek = {
  weekNumber: number;
  days: CalendarDay[];
};

const DUTCH_MONTHS = [
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

export function formatMonthTitle(year: number, month: number): string {
  const name = DUTCH_MONTHS[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function getIsoWeekNumber(date: Date): number {
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const week1 = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function buildCalendarWeeks(year: number, month: number): CalendarWeek[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks: CalendarWeek[] = [];
  let cursor = new Date(gridStart);

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const days: CalendarDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      days.push({
        date: new Date(cursor),
        isoDate: toIsoDate(cursor),
        isCurrentMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push({
      weekNumber: getIsoWeekNumber(days[0].date),
      days,
    });
  }

  return weeks;
}

/** ± margin around one fixed departure date (0 = exact). Period searches never carry a margin. */
export type FlexibilityDays = 0 | 1 | 2 | 3;

export const FLEXIBILITY_DAY_VALUES: readonly FlexibilityDays[] = [0, 1, 2, 3];

export function normalizeFlexibilityDays(value: unknown): FlexibilityDays {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

export type DepartureSelection = {
  start: string | null;
  end: string | null;
};

/** True when start/end describe a period (two different days), not one fixed date. */
export function isDeparturePeriod(start: string | null | undefined, end: string | null | undefined): boolean {
  return Boolean(start && end && start !== end);
}

/**
 * "Vaste vertrekdatum": every click selects exactly one day.
 * A second click only moves the selected day — it never creates a period.
 */
export function selectFixedDepartureDate(isoDate: string): DepartureSelection {
  return { start: isoDate, end: null };
}

/**
 * "Vertrekperiode": first click = first departure day, second (later) click = last day.
 * Clicking an earlier day or the same day restarts the period from that day.
 */
export function selectPeriodDepartureDate(
  current: DepartureSelection,
  isoDate: string,
): DepartureSelection {
  if (!current.start || current.end) {
    return { start: isoDate, end: null };
  }
  if (isoDate <= current.start) {
    return { start: isoDate, end: null };
  }
  return { start: current.start, end: isoDate };
}

/** Inclusive ± window around one fixed date (e.g. 21 nov ± 2 → 19 nov … 23 nov). */
export function flexibilityWindow(
  isoDate: string,
  flexibilityDays: number,
): { start: string; end: string } {
  const center = parseIsoDate(isoDate);
  const days = normalizeFlexibilityDays(flexibilityDays);
  return {
    start: toIsoDate(addDaysToDate(center, -days)),
    end: toIsoDate(addDaysToDate(center, days)),
  };
}

/** The margin that may be sent for a selection: always 0 for a period. */
export function flexibilityForSelection(
  start: string | null | undefined,
  end: string | null | undefined,
  flexibilityDays: number,
): FlexibilityDays {
  if (!start || isDeparturePeriod(start, end)) {
    return 0;
  }
  return normalizeFlexibilityDays(flexibilityDays);
}
