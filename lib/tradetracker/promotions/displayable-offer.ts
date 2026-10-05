/**
 * Concrete customer benefit for `/aanbiedingen`.
 * An item is an offer only when the source states a discount amount,
 * a percent, or a voucher code. "Last minute", "korting" or "boek nu"
 * without an amount is not an offer. Amounts are never invented.
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
  /** Source text only: raw discount/voucher values, or the amount as written. */
  benefitText: string | null;
  matchedTokens: string[];
};

/**
 * TradeTracker banner materials rejected as offers. They are generic
 * Banner*-lastminute creatives with no amount in the snapshot.
 */
export const REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS = [
  '2499691',
  '2499692',
  '2499693',
  '2499694',
  '2499695',
  '2499696',
  '2499697',
  '2499698',
  '2499700',
] as const;

const REJECTED_MATERIAL_IDS = new Set<string>(REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS);

const TOKEN_PATTERNS: readonly RegExp[] = [
  /last[\s-]?minute/gi,
  /early[\s-]?booking/gi,
  /vroegboek/gi,
  /korting/gi,
  /discount/gi,
];

const NEAR_MISS = /last[\s-]?minute|early[\s-]?booking|vroegboek|korting|discount/i;

/** Euro amounts and percentages as written. Zero is not a benefit. */
const AMOUNT_PATTERN = /€\s?\d{1,5}(?:[.,]\d{1,2})?|\d{1,3}(?:[.,]\d+)?\s?%/gi;

export function isRejectedGenericLastminuteMaterial(materialItemId: string | null | undefined): boolean {
  if (!materialItemId) {
    return false;
  }
  return REJECTED_MATERIAL_IDS.has(materialItemId);
}

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

function isZeroAmount(surface: string): boolean {
  const numeric = surface.replace(/[€%\s]/g, '').replace(',', '.');
  return /^0+(?:\.0+)?$/.test(numeric);
}

function amountSurfaces(text: string): string[] {
  const found: string[] = [];
  AMOUNT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_PATTERN.exec(text)) !== null) {
    const surface = match[0].replace(/\s+/g, ' ').trim();
    if (!surface || isZeroAmount(surface)) {
      continue;
    }
    found.push(surface);
  }
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
  const amounts: string[] = [];
  const seenTokens = new Set<string>();
  const seenAmounts = new Set<string>();
  let nearMiss = false;
  for (const text of textFields(input)) {
    for (const amount of amountSurfaces(text)) {
      const key = amount.toLowerCase();
      if (seenAmounts.has(key)) {
        continue;
      }
      seenAmounts.add(key);
      amounts.push(amount);
    }
    const matches = boundedMatches(text);
    if (matches.length === 0) {
      if (NEAR_MISS.test(text)) {
        nearMiss = true;
      }
      continue;
    }
    for (const match of matches) {
      const key = match.surface.toLowerCase();
      if (seenTokens.has(key)) {
        continue;
      }
      seenTokens.add(key);
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
  if (amounts.length > 0) {
    return {
      outcome: 'displayable',
      benefitText: amounts.join(' · '),
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
