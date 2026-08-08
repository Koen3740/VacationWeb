/** Canonical board/mealplan labels shown in Results filters. */
export const CANONICAL_BOARD_TYPES = [
  'Logies',
  'Logies & ontbijt',
  'Halfpension',
  'Halfpension Plus',
  'Volpension',
  'Volpension Plus',
  'All Inclusive',
  'Ultra All Inclusive',
] as const;

export type CanonicalBoardType = (typeof CANONICAL_BOARD_TYPES)[number];

const EXCLUDED_BOARD_TYPES = new Set([
  'zie beschrijving',
  'zie omschrijving',
  'n.v.t.',
  'nvt',
  'onbekend',
]);

/**
 * Full raw → canonical mapping for known feed variants.
 * Keys are lowercase trimmed source values.
 * Only spelling/spacing variants are merged — product variants like
 * "Halfpension Plus" stay distinct from "Halfpension".
 */
export const BOARD_TYPE_NORMALIZATION_MAP: Record<string, CanonicalBoardType> = {
  logies: 'Logies',
  lg: 'Logies',

  'logies en ontbijt': 'Logies & ontbijt',
  'logies & ontbijt': 'Logies & ontbijt',
  'logies ontbijt': 'Logies & ontbijt',
  'logies/ontbijt': 'Logies & ontbijt',
  'logies / ontbijt': 'Logies & ontbijt',
  'logies-ontbijt': 'Logies & ontbijt',
  lo: 'Logies & ontbijt',

  'half pension': 'Halfpension',
  halfpension: 'Halfpension',
  'half-pension': 'Halfpension',
  hp: 'Halfpension',

  'halfpension plus': 'Halfpension Plus',
  'half pension plus': 'Halfpension Plus',
  'half-pension plus': 'Halfpension Plus',

  'vol pension': 'Volpension',
  volpension: 'Volpension',
  'vol-pension': 'Volpension',
  vp: 'Volpension',

  'volpension plus': 'Volpension Plus',
  'vol pension plus': 'Volpension Plus',
  'vol-pension plus': 'Volpension Plus',

  'all inclusive': 'All Inclusive',
  'all-inclusive': 'All Inclusive',
  allinclusive: 'All Inclusive',
  ai: 'All Inclusive',

  'ultra all inclusive': 'Ultra All Inclusive',
  'ultra all-inclusive': 'Ultra All Inclusive',
  'ultra-all-inclusive': 'Ultra All Inclusive',
  ultraallinclusive: 'Ultra All Inclusive',
  ua: 'Ultra All Inclusive',
  uai: 'Ultra All Inclusive',
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_]+/g, ' ');
}

/** Returns canonical board type, or undefined when excluded / empty / unknown. */
export function canonicalizeBoardType(value: string | null | undefined): CanonicalBoardType | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const key = normalizeKey(trimmed);

  if (EXCLUDED_BOARD_TYPES.has(key)) {
    return undefined;
  }

  if (BOARD_TYPE_NORMALIZATION_MAP[key]) {
    return BOARD_TYPE_NORMALIZATION_MAP[key];
  }

  // Already canonical (exact display form)
  const exact = CANONICAL_BOARD_TYPES.find((item) => normalizeKey(item) === key);
  return exact;
}

export function canonicalizeBoardTypes(values: string[]): CanonicalBoardType[] {
  const seen = new Set<CanonicalBoardType>();
  const result: CanonicalBoardType[] = [];

  for (const value of values) {
    const canonical = canonicalizeBoardType(value);
    if (!canonical || seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    result.push(canonical);
  }

  return result;
}
