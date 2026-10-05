/**
 * One hero per offer list. The slot is a VacationWeb position, not a provider perk.
 *
 * Rule, given a UTC day index:
 * 1. No offers → no hero.
 * 2. One offer → that offer is the hero.
 * 3. Otherwise the providers are sorted by name. The day index picks one provider.
 * 4. That provider's offers are sorted by id. Each time that provider's turn
 *    comes around, the next of its offers is the hero.
 * 5. Every other offer is a normal card.
 *
 * No score, no image ranking, no manual priority. The same offers and the same
 * day always pick the same hero. A new day gives the next provider, then the
 * next offer of that provider, a turn.
 */

export type HeroCandidate = {
  id: string;
  providerName: string;
};

export function utcDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export function selectHeroOfferId(offers: readonly HeroCandidate[], dayIndex: number): string | null {
  if (offers.length === 0) {
    return null;
  }
  if (offers.length === 1) {
    return offers[0]?.id ?? null;
  }
  const day = Math.abs(Math.trunc(dayIndex));
  const providers = [...new Set(offers.map((offer) => offer.providerName))].sort((a, b) => a.localeCompare(b, 'nl'));
  const provider = providers[day % providers.length];
  const within = offers
    .filter((offer) => offer.providerName === provider)
    .sort((a, b) => a.id.localeCompare(b.id, 'nl'));
  const turn = Math.floor(day / providers.length);
  return within[turn % within.length]?.id ?? null;
}

export function assignHeroPlacement<T extends HeroCandidate & { placement: 'hero' | 'supporting' }>(
  offers: readonly T[],
  dayIndex: number,
): Array<Omit<T, 'placement'> & { placement: 'hero' | 'supporting' }> {
  const heroId = selectHeroOfferId(offers, dayIndex);
  return offers.map((offer) => ({
    ...offer,
    placement: offer.id === heroId ? 'hero' : 'supporting',
  }));
}
