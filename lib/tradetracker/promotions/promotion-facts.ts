import { decodeHtmlEntities } from '../../feeds/canonical/decode-html-entities';

/**
 * Verbatim facts that a TradeTracker promotion text states about itself.
 *
 * TradeTracker campaign news is free text written by the advertiser. Many
 * advertisers (all connected ones seen in the 2026-10-04 audit) structure it as
 * `Label: value` lines, for example `Actie: tot wel € 200,- extra korting`.
 * This module lifts those labelled lines out WITHOUT interpreting them: values
 * are returned as the source wrote them (tags stripped, entities decoded,
 * whitespace collapsed). Nothing is computed, converted or completed.
 */
export type PromotionFacts = {
  /** Text after the `Actie:` label, verbatim. */
  highlight: string | null;
  /** Source label of the period line (e.g. `Geldigheid`, `Periode`), as written. */
  periodLabel: string | null;
  /** Text of the period line, verbatim. */
  period: string | null;
  /** Text after `Voorwaarden:` / `Bijzonderheden:`, verbatim. */
  conditions: string | null;
};

export const EMPTY_PROMOTION_FACTS: PromotionFacts = {
  highlight: null,
  periodLabel: null,
  period: null,
  conditions: null,
};

const HIGHLIGHT_MAX_CHARS = 300;
const PERIOD_MAX_CHARS = 160;
const CONDITIONS_MAX_CHARS = 280;

/** Priority order: the first label present wins. */
const PERIOD_LABELS = [
  'geldigheid',
  'actieperiode',
  'boekingsperiode',
  'boekperiode',
  'periode',
  'vertrekperiode',
  'reisperiode',
  'verblijfsperiode',
] as const;

const CONDITION_LABELS = ['voorwaarden', 'bijzonderheden'] as const;

const LABELLED_LINE = /^([^:\n]{2,40}):\s*(\S.*)$/;

/** Common named entities that the shared decoder (amp/quot/apos/lt/gt/nbsp) leaves untouched. */
const EXTRA_ENTITIES: Record<string, string> = {
  euro: '\u20AC',
  hellip: '\u2026',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  middot: '\u00B7',
  deg: '\u00B0',
  copy: '\u00A9',
  reg: '\u00AE',
  eacute: '\u00E9',
  egrave: '\u00E8',
  euml: '\u00EB',
  iuml: '\u00EF',
  agrave: '\u00E0',
  auml: '\u00E4',
  ouml: '\u00F6',
  uuml: '\u00FC',
  ccedil: '\u00E7',
};

function decode(value: string): string {
  return decodeHtmlEntities(value).replace(/&([a-zA-Z]+);/g, (entity, name: string) => {
    return EXTRA_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Strip tags (block tags become line breaks), decode entities, keep line structure. */
function toPlainLines(html: string): string[] {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6]|tr)\s*>/gi, '\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, ' ');
  return decode(withoutTags)
    .split(/\r?\n/)
    .map(collapse)
    .filter((line) => line.length > 0);
}

/** Collapse whitespace and shorten very long plain text at a word boundary. */
function limitPlainText(plain: string, maxChars: number): string | null {
  const clean = collapse(plain);
  if (!clean) {
    return null;
  }
  if (clean.length <= maxChars) {
    return clean;
  }
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > Math.floor(maxChars * 0.5) ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}\u2026`;
}

/** Clean one fragment of raw (possibly HTML) source text; shorten it at a word boundary if very long. */
export function cleanFactText(value: string | null | undefined, maxChars: number): string | null {
  if (!value) {
    return null;
  }
  return limitPlainText(
    decode(value.replace(/<\s*br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ')),
    maxChars,
  );
}

function plain(value: string | undefined, maxChars: number): string | null {
  return value ? limitPlainText(value, maxChars) : null;
}

export function extractPromotionFacts(content: string | null | undefined): PromotionFacts {
  if (!content) {
    return { ...EMPTY_PROMOTION_FACTS };
  }

  const found = new Map<string, { label: string; value: string }>();
  for (const line of toPlainLines(content)) {
    const match = LABELLED_LINE.exec(line);
    if (!match) {
      continue;
    }
    const label = match[1]!.trim();
    const key = label.toLocaleLowerCase('nl');
    if (!found.has(key)) {
      found.set(key, { label, value: match[2]!.trim() });
    }
  }

  const highlight = plain(found.get('actie')?.value, HIGHLIGHT_MAX_CHARS);

  let periodLabel: string | null = null;
  let period: string | null = null;
  for (const key of PERIOD_LABELS) {
    const entry = found.get(key);
    const value = plain(entry?.value, PERIOD_MAX_CHARS);
    if (entry && value) {
      periodLabel = entry.label;
      period = value;
      break;
    }
  }

  let conditions: string | null = null;
  for (const key of CONDITION_LABELS) {
    const value = plain(found.get(key)?.value, CONDITIONS_MAX_CHARS);
    if (value) {
      conditions = value;
      break;
    }
  }

  return { highlight, periodLabel, period, conditions };
}
