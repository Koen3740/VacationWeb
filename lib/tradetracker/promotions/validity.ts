import type { PromotionalValidity, PromotionalValidityStatus } from './types';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

export function utcCalendarDate(asOfMs: number): string {
  const d = new Date(asOfMs);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid asOfMs for promotional validity');
  }
  return d.toISOString().slice(0, 10);
}

/** Parse TradeTracker xsd:date / dateTime to YYYY-MM-DD, or null if absent/unparseable. */
export function toCalendarDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const match = DATE_ONLY.exec(text);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function compareCalendarDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function promotionalValidity(args: {
  startDate: string | null;
  endDate: string | null;
  asOfMs: number;
}): PromotionalValidity {
  const asOfUtcDate = utcCalendarDate(args.asOfMs);
  const startDate = args.startDate;
  const endDate = args.endDate;

  let status: PromotionalValidityStatus;
  if (!startDate) {
    status = 'undated';
  } else if (compareCalendarDates(asOfUtcDate, startDate) < 0) {
    status = 'scheduled';
  } else if (endDate && compareCalendarDates(asOfUtcDate, endDate) > 0) {
    status = 'expired';
  } else {
    status = 'active';
  }

  return {
    status,
    isActive: status === 'active',
    asOfUtcDate,
    startDate,
    endDate,
    timezoneAssumption: 'utc-calendar-date',
  };
}
