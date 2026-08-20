import { derivedAgeYears } from '@/components/search/travelers-popup/travelers-popup-utils';
import type { SearchParams } from '@/types/travel';

/**
 * Display-only age bands derived from dateOfBirth.
 * Not stored on party-state and not a provider occupancy encoding.
 *
 * - baby: 0–1
 * - child: 2–17
 * - adult: 18+
 */
export const DISPLAY_ADULT_MIN_AGE = 18;
export const DISPLAY_CHILD_MIN_AGE = 2;

export type OccupancyAgeCounts = {
  adults: number;
  children: number;
  babies: number;
  persons: number;
  rooms: number;
  /** True when every traveller could be classified from a valid DOB, or legacy A/C/B counts were used. */
  classified: boolean;
};

function roomCountFromSearchParams(params: SearchParams): number {
  const fromParty = params.party?.length
    ? Math.max(...params.party.map((traveller) => traveller.roomIndex + 1))
    : 1;
  const fromParam = params.rooms ?? 1;
  return Math.max(1, fromParam, fromParty);
}

function ageBandFromYears(age: number): 'A' | 'C' | 'B' {
  if (age < DISPLAY_CHILD_MIN_AGE) {
    return 'B';
  }
  if (age < DISPLAY_ADULT_MIN_AGE) {
    return 'C';
  }
  return 'A';
}

export function occupancyAgeCountsFromSearchParams(
  params: SearchParams,
  today: Date = new Date(),
): OccupancyAgeCounts {
  const rooms = roomCountFromSearchParams(params);

  if (params.party && params.party.length > 0) {
    const persons = params.party.length;
    const counts = { A: 0, C: 0, B: 0 };
    for (const traveller of params.party) {
      if (!traveller.dateOfBirth) {
        return { adults: 0, children: 0, babies: 0, persons, rooms, classified: false };
      }
      const age = derivedAgeYears(traveller.dateOfBirth, today);
      if (age == null) {
        return { adults: 0, children: 0, babies: 0, persons, rooms, classified: false };
      }
      counts[ageBandFromYears(age)] += 1;
    }
    return {
      adults: counts.A,
      children: counts.C,
      babies: counts.B,
      persons,
      rooms,
      classified: true,
    };
  }

  return {
    adults: params.adults ?? 2,
    children: params.children ?? 0,
    babies: params.babies ?? 0,
    persons: (params.adults ?? 2) + (params.children ?? 0) + (params.babies ?? 0),
    rooms,
    classified: true,
  };
}

/**
 * Compact occupancy category for telemetry, e.g. `2A / 1R`, `2A+2C / 2R`, `4P / 2R`.
 * Never includes dates of birth.
 */
export function occupancyCategoryFromSearchParams(
  params: SearchParams,
  today: Date = new Date(),
): string {
  const counts = occupancyAgeCountsFromSearchParams(params, today);
  if (!counts.classified) {
    return `${counts.persons}P / ${counts.rooms}R`;
  }

  const parts: string[] = [];
  if (counts.adults > 0) {
    parts.push(`${counts.adults}A`);
  }
  if (counts.children > 0) {
    parts.push(`${counts.children}C`);
  }
  if (counts.babies > 0) {
    parts.push(`${counts.babies}B`);
  }
  if (parts.length === 0) {
    parts.push(`${counts.persons}P`);
  }
  return `${parts.join('+')} / ${counts.rooms}R`;
}

function nlCountLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Dutch UI composition from party DOBs (or legacy A/C/B params).
 * Canonical storage remains travellers[].dateOfBirth.
 */
export function formatOccupancySummaryParts(
  params: SearchParams,
  options: { includeRooms?: boolean; today?: Date } = {},
): string[] {
  const counts = occupancyAgeCountsFromSearchParams(params, options.today);
  const parts: string[] = [];

  if (!counts.classified) {
    parts.push(nlCountLabel(counts.persons, 'reiziger', 'reizigers'));
  } else {
    if (counts.adults > 0) {
      parts.push(nlCountLabel(counts.adults, 'volwassene', 'volwassenen'));
    }
    if (counts.children > 0) {
      parts.push(nlCountLabel(counts.children, 'kind', 'kinderen'));
    }
    if (counts.babies > 0) {
      parts.push(nlCountLabel(counts.babies, 'baby', "baby's"));
    }
  }

  const includeRooms = options.includeRooms ?? true;
  if (includeRooms && counts.rooms > 0) {
    parts.push(nlCountLabel(counts.rooms, 'kamer', 'kamers'));
  }

  return parts;
}

export function formatOccupancyCompositionNl(
  params: SearchParams,
  options: { includeRooms?: boolean; today?: Date; joiner?: string } = {},
): string {
  return formatOccupancySummaryParts(params, options).join(options.joiner ?? ' • ');
}
