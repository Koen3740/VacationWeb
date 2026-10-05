/**
 * Concrete customer benefit for `/aanbiedingen`.
 * A banner is an offer only when TradeTracker itself supplied a discount,
 * a voucher code, or an explicit promo token in the source text.
 * Generic provider ads are excluded. Doubt is excluded. Amounts are never invented.
 */

export type OfferBenefitFields = {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  conditions?: string | null;
  discountFixed?: string | null;
  discountVariable?: string | null;
  voucherCode?: string | null;
};

export type OfferBenefitOutcome = 'displayable' | 'excluded' | 'doubt';

export type OfferBenefitDecision = {
  outcome: OfferBenefitOutcome;
  /** Source text only: raw discount/voucher values, or the matched token spelling. */
  benefitText: string | null;
  matchedTokens: string[];
};

const TOKEN_PATTERNS: readonly RegExp[] = [
  /last[\s-]?minute/gi,
  /early[\s-]?booking/gi,
  /vroegboek/gi,
  /korting/gi,
  /discount/gi,
];

const NEAR_MISS = /last[\s-]?minute|early[\s-]?booking|vroegboek|korting|discount/i;

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function isWordBoundary(char: string): boolean {
  return char === '' || !/[a-z0-9]/i.test(char);
}

function boundedMatches(text: string): { index: number; surface: string }[] {
  const found: { index: number; surface: string }[] = [];
  for (const pattern of TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const surface = match[0];
      const start = match.index;
      const before = start === 0 ? '' : text.charAt(start - 1);
      const after = text.charAt(start + surface.length);
      if (isWordBoundary(before) && isWordBoundary(after)) {
        found.push({ index: start, surface });
      }
      if (surface.length === 0) {
        break;
      }
    }
  }
  found.sort((a, b) => a.index - b.index || a.surface.localeCompare(b.surface, 'nl'));
  return found;
}

/** Zero amounts are not a customer benefit. Any other non-empty source value is kept verbatim. */
function structuredSource(value: string | null | undefined): string | null {
  const text = clean(value);
  if (!text) {
    return null;
  }
  const numeric = text.replace(/[€$£\s]/g, '').replace(',', '.');
  if (/^0+(?:\.0+)?%?$/.test(numeric)) {
    return null;
  }
  return text;
}

function textFields(input: OfferBenefitFields): string[] {
  return [input.name, input.title, input.description, input.summary, input.conditions]
    .map((value) => clean(value))
    .filter((value) => value.length > 0);
}

export function evaluateOfferBenefit(input: OfferBenefitFields): OfferBenefitDecision {
  const structured = [input.discountFixed, input.discountVariable, input.voucherCode]
    .map((value) => structuredSource(value))
    .filter((value): value is string => Boolean(value));

  const surfaces: string[] = [];
  const seen = new Set<string>();
  let nearMiss = false;
  for (const text of textFields(input)) {
    const matches = boundedMatches(text);
    if (matches.length === 0) {
      if (NEAR_MISS.test(text)) {
        nearMiss = true;
      }
      continue;
    }
    for (const match of matches) {
      const key = match.surface.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      surfaces.push(match.surface);
    }
  }

  if (structured.length > 0) {
    return {
      outcome: 'displayable',
      benefitText: structured.join(' · '),
      matchedTokens: surfaces,
    };
  }
  if (surfaces.length > 0) {
    return {
      outcome: 'displayable',
      benefitText: surfaces.join(' · '),
      matchedTokens: surfaces,
    };
  }
  if (nearMiss) {
    return { outcome: 'doubt', benefitText: null, matchedTokens: [] };
  }
  return { outcome: 'excluded', benefitText: null, matchedTokens: [] };
}

/** True only for a concrete source benefit. Doubt and generic ads are false. */
export function isDisplayableOffer(creative: OfferBenefitFields): boolean {
  return evaluateOfferBenefit(creative).outcome === 'displayable';
}
