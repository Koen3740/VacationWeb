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
