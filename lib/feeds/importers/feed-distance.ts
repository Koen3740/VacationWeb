/**
 * Structured centre distance from provider feed lines, e.g.
 * `afstand tot centrum: circa 500 meter` (Sunweb `accommodation`/`facilities`,
 * Eliza `accommodation`). The FIRST number of the line is used (the provider
 * filter buckets on that number, see stad-benchmark-providers.md); named
 * places after it are ignored. `in het centrum` is only set for the literal item.
 * Unknown stays unknown: nothing is derived from any other text.
 */
export type FeedCenterDistance = {
  centerDistanceM?: number;
  centerIsIn?: true;
};

const MAX_FEED_DISTANCE_M = 100_000;
const NUMBER_WITH_UNIT = /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kilometers?|kilometres?|km|meters?|metres?|m)\b/i;

function toMeters(token: string, unit: string): number | undefined {
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(token)
    ? token.replace(/\./g, '')
    : token.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return undefined;
  }
  const meters = unit.toLowerCase().startsWith('k') ? Math.round(value * 1000) : Math.round(value);
  return meters <= MAX_FEED_DISTANCE_M ? meters : undefined;
}

export function parseCenterDistanceFromFeedValues(values: readonly string[]): FeedCenterDistance {
  let centerDistanceM: number | undefined;
  let centerIsIn = false;

  for (const raw of values) {
    const text = raw.trim().toLowerCase();
    if (!text) {
      continue;
    }

    for (const item of text.split(/[,;]/)) {
      if (item.trim() === 'in het centrum') {
        centerIsIn = true;
      }
    }

    if (centerDistanceM !== undefined) {
      continue;
    }

    for (const chunk of text.split(/(?=afstand tot )/)) {
      const label = /^afstand tot (?:het )?centrum\b:?(.*)$/s.exec(chunk);
      if (!label) {
        continue;
      }
      const number = NUMBER_WITH_UNIT.exec(label[1]);
      if (!number) {
        continue;
      }
      const meters = toMeters(number[1], number[2]);
      if (meters !== undefined) {
        centerDistanceM = meters;
        break;
      }
    }
  }

  const result: FeedCenterDistance = {};
  if (centerDistanceM !== undefined) {
    result.centerDistanceM = centerDistanceM;
  }
  if (centerIsIn) {
    result.centerIsIn = true;
  }
  return result;
}