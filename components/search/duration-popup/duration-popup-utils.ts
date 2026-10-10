export const DURATION_MIN = 2;
export const DURATION_MAX = 32;

export function buildDurationOptions(): number[] {
  return Array.from(
    { length: DURATION_MAX - DURATION_MIN + 1 },
    (_, index) => DURATION_MIN + index,
  );
}

export function toggleDuration(selected: number[], days: number): number[] {
  const next = selected.includes(days)
    ? selected.filter((value) => value !== days)
    : [...selected, days];

  return next.sort((a, b) => a - b);
}

export function formatSelectedDurationsLabel(selected: number[]): string {
  if (selected.length === 0) {
    return 'Reisduur';
  }

  const sorted = [...selected].sort((a, b) => a - b);
  const groups: number[][] = [];

  for (const days of sorted) {
    const lastGroup = groups[groups.length - 1];
    const previous = lastGroup?.[lastGroup.length - 1];

    if (lastGroup && previous !== undefined && days === previous + 1) {
      lastGroup.push(days);
    } else {
      groups.push([days]);
    }
  }

  const formattedGroups = groups.map((group) => {
    if (group.length === 1) {
      return String(group[0]);
    }

    return `${group[0]}–${group[group.length - 1]}`;
  });

  return `${formattedGroups.join(', ')} dagen`;
}

/** Expand an inclusive nightsMin..nightsMax range into discrete duration days. */
export function expandDurationRange(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return [];
  }

  const start = Math.max(DURATION_MIN, Math.floor(min));
  const end = Math.min(DURATION_MAX, Math.floor(max));
  if (start > end) {
    return [];
  }

  const out: number[] = [];
  for (let day = start; day <= end; day += 1) {
    out.push(day);
  }
  return out;
}

/**
 * Single source of truth for active duration criteria from the URL.
 * Prefers discrete `nights`; falls back to explicit `nightsMin`+`nightsMax`.
 */
export function parseDurationsFromSearchParams(searchParams: {
  get(name: string): string | null;
}): number[] {
  const nights = searchParams.get('nights');
  if (nights) {
    return nights
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
  }

  const minRaw = searchParams.get('nightsMin');
  const maxRaw = searchParams.get('nightsMax');
  if (minRaw === null || maxRaw === null) {
    return [];
  }

  return expandDurationRange(Number(minRaw), Number(maxRaw));
}

export type DurationRange = {
  min: number;
  max: number;
};

function clampDurationDay(value: number): number {
  if (!Number.isFinite(value)) {
    return DURATION_MIN;
  }
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(value)));
}

/**
 * Popup range (min..max trip days) from the existing `nights` list.
 * Empty list = no duration filter = full range. A legacy non-contiguous list
 * (e.g. `nights=7,14`) is shown as its outer bounds (7..14).
 */
export function durationRangeFromSelection(selected: number[]): DurationRange {
  const valid = selected.filter((value) => Number.isFinite(value));
  if (valid.length === 0) {
    return { min: DURATION_MIN, max: DURATION_MAX };
  }
  const min = clampDurationDay(Math.min(...valid));
  const max = clampDurationDay(Math.max(...valid));
  return min <= max ? { min, max } : { min: max, max: min };
}

export function isFullDurationRange(range: DurationRange): boolean {
  return range.min <= DURATION_MIN && range.max >= DURATION_MAX;
}

/**
 * Map a min..max range onto the existing URL/search representation (`nights` = list of trip days).
 * Full range = no filter (empty list), otherwise the contiguous list min..max.
 */
export function durationSelectionFromRange(range: DurationRange): number[] {
  const normalized = normalizeDurationRange(range.min, range.max);
  if (isFullDurationRange(normalized)) {
    return [];
  }
  return expandDurationRange(normalized.min, normalized.max);
}

/*
 * Reisduur has two explicit ways to choose (Koen, 01-10-2026): EXACT (one number of days) and
 * FLEXIBEL (a range). There is no "any duration" choice: not choosing = no `nights` param
 * (existing URL semantics, kept internally, never presented as an option).
 * URL: exact = `nights=8` (one element, equivalent to nightsMin=nightsMax=8); flexible = the
 * contiguous `nights=7,8,9,10` list. `nights` is trip days for every provider (no conversion).
 */
export type DurationMode = 'exact' | 'flexibel';

/** Most common catalog duration (5.855 of 8.433 offers). Shown selected when the popup opens with no `nights` filter; OPSLAAN commits it. */
export const DEFAULT_EXACT_DURATION = 8;

/**
 * Common trip lengths (days) offered as chips. A range chip is the contiguous `nights` list
 * (the same representation the old Flexibel range wrote). Single days stay a one-element list.
 * Multi-select is the union of those lists: `filterOffers` already matches `nights` by membership.
 */
export type DurationChip = {
  id: string;
  label: string;
  days: readonly number[];
};

export const DURATION_CHIPS: readonly DurationChip[] = [
  { id: '3-4', label: '3–4', days: [3, 4] },
  { id: '5-6', label: '5–6', days: [5, 6] },
  { id: '8', label: '8', days: [8] },
  { id: '10-11', label: '10–11', days: [10, 11] },
  { id: '15', label: '15', days: [15] },
  { id: '22', label: '22 dagen', days: [22] },
];

export function durationChipById(id: string): DurationChip | undefined {
  return DURATION_CHIPS.find((chip) => chip.id === id);
}

function uniqueSortedDays(days: readonly number[]): number[] {
  return [...new Set(days.filter((day) => Number.isFinite(day)))].sort((a, b) => a - b);
}

export function durationChipAriaLabel(chip: DurationChip): string {
  if (chip.days.length === 1) {
    return `${chip.days[0]} dagen`;
  }
  return `${chip.days[0]} tot ${chip.days[chip.days.length - 1]} dagen`;
}

/** Days contributed by the chips the user turned on. */
export function daysFromDurationChips(chipIds: readonly string[]): number[] {
  const days: number[] = [];
  for (const id of chipIds) {
    const chip = durationChipById(id);
    if (chip) {
      days.push(...chip.days);
    }
  }
  return uniqueSortedDays(days);
}

/**
 * Split a `nights` list into chips plus at most one custom day.
 * Anything else (for example a legacy `nights=7,14` or `7,8,9,10`) is `legacy`: the popup
 * keeps that list until the user picks a chip or a custom day, and does not widen it.
 */
export function explainDurationSelection(selected: readonly number[]): {
  chipIds: string[];
  customDay: number | null;
  legacy: boolean;
} {
  const days = uniqueSortedDays(selected);
  if (days.length === 0) {
    return { chipIds: [], customDay: null, legacy: false };
  }

  const chipIds = DURATION_CHIPS.filter((chip) => chip.days.every((day) => days.includes(day))).map((chip) => chip.id);
  const covered = new Set(daysFromDurationChips(chipIds));
  const leftover = days.filter((day) => !covered.has(day));
  if (leftover.length <= 1) {
    return { chipIds, customDay: leftover[0] ?? null, legacy: false };
  }
  return { chipIds: [], customDay: null, legacy: true };
}

export type DurationChoiceDraft = {
  chipIds: string[];
  customOpen: boolean;
  customDay: number | null;
  /** Applied list that is not a chip/custom combination. Null once the user edits. */
  legacyDays: number[] | null;
};

/** Popup draft. An empty URL shows 8 selected (the catalog mode); that choice is committed only on OPSLAAN. */
export function durationDraftFromApplied(selected: readonly number[]): DurationChoiceDraft {
  if (selected.length === 0) {
    return {
      chipIds: [String(DEFAULT_EXACT_DURATION)],
      customOpen: false,
      customDay: null,
      legacyDays: null,
    };
  }

  const explained = explainDurationSelection(selected);
  if (explained.legacy) {
    return {
      chipIds: [],
      customOpen: false,
      customDay: null,
      legacyDays: uniqueSortedDays(selected),
    };
  }

  return {
    chipIds: explained.chipIds,
    customOpen: explained.customDay !== null,
    customDay: explained.customDay,
    legacyDays: null,
  };
}

/** `nights` list the draft would write. Legacy lists pass through unchanged. */
export function durationDaysFromDraft(draft: DurationChoiceDraft): number[] {
  if (draft.legacyDays) {
    return uniqueSortedDays(draft.legacyDays);
  }
  const custom = draft.customOpen && draft.customDay !== null ? [clampDurationDay(draft.customDay)] : [];
  return uniqueSortedDays([...daysFromDurationChips(draft.chipIds), ...custom]);
}

export function sameDurationSelection(left: readonly number[], right: readonly number[]): boolean {
  const a = uniqueSortedDays(left);
  const b = uniqueSortedDays(right);
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

/** First day not already covered by the selected chips. Prefers 8, then the next higher day. */
export function suggestCustomDuration(chipIds: readonly string[]): number {
  const taken = new Set(daysFromDurationChips(chipIds));
  if (!taken.has(DEFAULT_EXACT_DURATION)) {
    return DEFAULT_EXACT_DURATION;
  }
  for (let day = DEFAULT_EXACT_DURATION + 1; day <= DURATION_MAX; day += 1) {
    if (!taken.has(day)) {
      return day;
    }
  }
  for (let day = DURATION_MIN; day < DEFAULT_EXACT_DURATION; day += 1) {
    if (!taken.has(day)) {
      return day;
    }
  }
  return DEFAULT_EXACT_DURATION;
}

export function toggleDurationChipDraft(draft: DurationChoiceDraft, chip: DurationChip): DurationChoiceDraft {
  if (draft.legacyDays) {
    return { chipIds: [chip.id], customOpen: false, customDay: null, legacyDays: null };
  }
  const chipIds = draft.chipIds.includes(chip.id)
    ? draft.chipIds.filter((id) => id !== chip.id)
    : [...draft.chipIds, chip.id];
  return { ...draft, chipIds };
}

/** Opens the custom stepper on one day, or closes it and drops that day. */
export function toggleCustomDurationDraft(draft: DurationChoiceDraft): DurationChoiceDraft {
  if (draft.customOpen && !draft.legacyDays) {
    return { ...draft, customOpen: false, customDay: null };
  }
  if (draft.legacyDays) {
    return {
      chipIds: [],
      customOpen: true,
      customDay: clampDurationDay(Math.min(...draft.legacyDays)),
      legacyDays: null,
    };
  }
  return {
    ...draft,
    customOpen: true,
    customDay: suggestCustomDuration(draft.chipIds),
  };
}

export function stepCustomDurationDraft(draft: DurationChoiceDraft, delta: number): DurationChoiceDraft {
  const base = draft.legacyDays
    ? { chipIds: [], customOpen: true, customDay: Math.min(...draft.legacyDays), legacyDays: null }
    : draft;
  const current = base.customDay ?? suggestCustomDuration(base.chipIds);
  return {
    ...base,
    customOpen: true,
    customDay: clampDurationDay(current + delta),
    legacyDays: null,
  };
}

export function clearDurationDraft(): DurationChoiceDraft {
  return { chipIds: [], customOpen: false, customDay: null, legacyDays: null };
}

/** Flexible range seeded from an exact value (e.g. 7 -> 7-10). */
export const FLEXIBLE_SEED_SPAN = 3;

export function clampExactDuration(days: number): number {
  return clampDurationDay(days);
}

/** 0 or 1 chosen value = exact; a list of several days = flexible range. */
export function durationModeFromSelection(selected: number[]): DurationMode {
  const valid = selected.filter((value) => Number.isFinite(value));
  return new Set(valid).size >= 2 ? 'flexibel' : 'exact';
}

export function exactDurationFromSelection(selected: number[]): number {
  const valid = selected.filter((value) => Number.isFinite(value));
  if (valid.length === 0) {
    return DEFAULT_EXACT_DURATION;
  }
  return clampDurationDay(Math.min(...valid));
}

export function durationSelectionFromExact(days: number): number[] {
  return [clampDurationDay(days)];
}

export function flexibleRangeFromExact(days: number): DurationRange {
  const min = clampDurationDay(days);
  return { min, max: Math.min(DURATION_MAX, min + FLEXIBLE_SEED_SPAN) };
}

/**
 * Flexible range: same rules as `normalizeDurationRange`, but the full 2..32 span is never an
 * explicit choice (that would be "any duration"): the moved handle stops one step before it.
 */
export function normalizeFlexibleDurationRange(
  min: number,
  max: number,
  changed: 'min' | 'max' = 'min',
): DurationRange {
  const next = normalizeDurationRange(min, max, changed);
  if (isFullDurationRange(next)) {
    return changed === 'min'
      ? { min: DURATION_MIN + 1, max: next.max }
      : { min: next.min, max: DURATION_MAX - 1 };
  }
  return next;
}

/** Flexible draft from an applied list; a legacy full 2..32 list is shown one step narrower. */
export function flexibleRangeFromSelection(selected: number[]): DurationRange {
  const range = durationRangeFromSelection(selected);
  return normalizeFlexibleDurationRange(range.min, range.max, 'max');
}

/** Clamp to 2..32 and enforce min <= max; the handle that moved (`changed`) wins. */
export function normalizeDurationRange(
  min: number,
  max: number,
  changed: 'min' | 'max' = 'min',
): DurationRange {
  let nextMin = clampDurationDay(min);
  let nextMax = clampDurationDay(max);
  if (nextMin > nextMax) {
    if (changed === 'min') {
      nextMin = nextMax;
    } else {
      nextMax = nextMin;
    }
  }
  return { min: nextMin, max: nextMax };
}

export function formatDurationRangeLabel(range: DurationRange): string {
  if (range.min === range.max) {
    return `${range.min} dagen`;
  }
  return `${range.min}–${range.max} dagen`;
}

/*
 * Duration slider geometry (Variant C: one track, two handles).
 * Every value has a position on the track; the min handle sits just LEFT of its value position and
 * the max handle just RIGHT of it (a bracket around the chosen days). Handle centres are therefore
 * always at least one handle width + gap apart, even when min === max, so the handles never touch
 * or overlap while keeping a normal visible size. Value positions are inset so the outer handles
 * (min at 2, max at 32) stay inside the track.
 */
export type DurationHandle = 'min' | 'max';

/** Visible handle diameter in px (same on desktop and touch). */
export const DURATION_HANDLE_SIZE = 20;
/** Minimum empty space in px between the two handles. */
export const DURATION_HANDLE_GAP = 4;
/** Distance from a value position to its handle centre. */
export const DURATION_HANDLE_SHIFT = DURATION_HANDLE_SIZE / 2 + DURATION_HANDLE_GAP / 2;
/** Inset of the value 2 / value 32 positions from the track edges. */
export const DURATION_VALUE_INSET = DURATION_HANDLE_SIZE + DURATION_HANDLE_GAP / 2;

function clampDuration(value: number): number {
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, value));
}

export function durationValueRatio(value: number): number {
  return (clampDuration(value) - DURATION_MIN) / (DURATION_MAX - DURATION_MIN);
}

/** X (px from the track's left edge) of a value position. */
export function durationValueX(value: number, trackWidth: number): number {
  const usable = Math.max(0, trackWidth - 2 * DURATION_VALUE_INSET);
  return DURATION_VALUE_INSET + durationValueRatio(value) * usable;
}

/** X of a handle centre: min handle left of its value, max handle right of it. */
export function durationHandleCenterX(handle: DurationHandle, value: number, trackWidth: number): number {
  const x = durationValueX(value, trackWidth);
  return handle === 'min' ? x - DURATION_HANDLE_SHIFT : x + DURATION_HANDLE_SHIFT;
}

/** CSS `left` (percent-of-track based, no measuring needed) for a value position. */
export function durationValueCssLeft(value: number): string {
  return `calc(${DURATION_VALUE_INSET}px + (100% - ${2 * DURATION_VALUE_INSET}px) * ${durationValueRatio(value)})`;
}

/** CSS `left` for a handle centre (pair with margin-left: -handleSize/2). */
export function durationHandleCssLeft(handle: DurationHandle, value: number): string {
  const offset = handle === 'min'
    ? DURATION_VALUE_INSET - DURATION_HANDLE_SHIFT
    : DURATION_VALUE_INSET + DURATION_HANDLE_SHIFT;
  return `calc(${offset}px + (100% - ${2 * DURATION_VALUE_INSET}px) * ${durationValueRatio(value)})`;
}

/** Inverse of `durationHandleCenterX`: the (rounded, clamped) value for a handle centre at x. */
export function durationValueFromHandleX(handle: DurationHandle, centerX: number, trackWidth: number): number {
  const usable = trackWidth - 2 * DURATION_VALUE_INSET;
  if (!(usable > 0)) {
    return handle === 'min' ? DURATION_MIN : DURATION_MAX;
  }
  const valueX = handle === 'min' ? centerX + DURATION_HANDLE_SHIFT : centerX - DURATION_HANDLE_SHIFT;
  const ratio = Math.min(1, Math.max(0, (valueX - DURATION_VALUE_INSET) / usable));
  return clampDuration(Math.round(DURATION_MIN + ratio * (DURATION_MAX - DURATION_MIN)));
}

/** Pointer → handle: the nearest handle; the hit areas split at the midpoint between both centres. */
export function pickDurationHandle(pointerX: number, range: DurationRange, trackWidth: number): DurationHandle {
  const minCenter = durationHandleCenterX('min', range.min, trackWidth);
  const maxCenter = durationHandleCenterX('max', range.max, trackWidth);
  return pointerX <= (minCenter + maxCenter) / 2 ? 'min' : 'max';
}
