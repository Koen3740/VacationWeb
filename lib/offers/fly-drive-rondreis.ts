/**
 * Proven Fly & Drive = rondreis/rondtrekken classification (provider-specific).
 *
 * SSOT: docs/research/provider-landscape/autoproducten-rondreis-classificatie.md
 *
 * NOT wired into Results filtering / vacationTypes. That remains a separate
 * product decision. Do not treat hasCarRental as rondreis proof.
 *
 * Proven today:
 * - Corendon / Sunweb: product designation "Fly & Drive" on the offer name
 *   ⇒ rondreis. "Fly & Go" and ordinary huurauto ⇒ not rondreis.
 * - Eliza: no feed rondreis products ⇒ never true from catalog signals.
 * - Other providers: not proven ⇒ false (investigate during onboarding).
 */

import type { TravelOffer } from '@/types/travel';

const FLY_AND_DRIVE_NAME = /fly\s*&\s*drive/i;
const FLY_AND_GO_NAME = /fly\s*&\s*go/i;

function providerKey(provider: string | undefined): string {
  return (provider ?? '').trim().toLowerCase();
}

/**
 * True only when a proven provider-specific Fly & Drive (rondreis) signal is present.
 * Ordinary huurauto / Fly & Go / Eliza / unknown providers return false.
 */
export function isProvenFlyAndDriveRondreis(offer: {
  provider?: string;
  hotelName?: string;
  hasCarRental?: boolean;
}): boolean {
  const provider = providerKey(offer.provider);
  const name = offer.hotelName ?? '';

  if (provider === 'eliza was here' || provider === 'eliza') {
    return false;
  }

  if (provider !== 'corendon' && provider !== 'sunweb') {
    return false;
  }

  // Fly & Go is explicitly not rondreis (Corendon). Name check alone.
  if (FLY_AND_GO_NAME.test(name) && !FLY_AND_DRIVE_NAME.test(name)) {
    return false;
  }

  return FLY_AND_DRIVE_NAME.test(name);
}

/** Convenience: proven rondreis helper never reads hasCarRental as authority. */
export function offerHasCarRentalIsNotRondreisProof(offer: TravelOffer): boolean {
  return offer.hasCarRental === true && !isProvenFlyAndDriveRondreis(offer);
}
