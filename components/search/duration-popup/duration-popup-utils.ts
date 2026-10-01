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
  if (isFullDurationRange(range)) {
    return 'Elke duur';
  }
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
