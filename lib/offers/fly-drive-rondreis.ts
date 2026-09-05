/**
 * Proven Roadtrip (Fly & Drive) classification — provider-specific.
 *
 * SSOT: docs/research/provider-landscape/autoproducten-rondreis-classificatie.md
 *
 * Wired into Results vacationTypes "Fly & Drive" as Roadtrip (Fly & Drive).
 * Independent of hasCarRental (ordinary huurauto).
 *
 * Proven today:
 * - Corendon / Sunweb: product designation "Fly & Drive" on the offer name
 *   ⇒ Roadtrip. "Fly & Go" and ordinary huurauto ⇒ not Roadtrip.
 * - Eliza: no feed Roadtrip products ⇒ never true from catalog signals.
 * - Other providers: not proven ⇒ false (investigate during onboarding).
 *
 * Do NOT use subcategory token `Fly-Drive vakantie` alone (covers Fly & Go).
 * Do NOT use hasCarRental as Roadtrip proof.
 * Do NOT treat any textual "fly-drive" occurrence in long copy as Roadtrip.
 */

import type { TravelOffer } from '@/types/travel';

const FLY_AND_DRIVE_NAME = /fly\s*&\s*drive/i;
const FLY_AND_GO_NAME = /fly\s*&\s*go/i;

function providerKey(provider: string | undefined): string {
  return (provider ?? '').trim().toLowerCase();
}

/**
 * True only when a proven provider-specific Fly & Drive (Roadtrip) signal is present.
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

  // Fly & Go is explicitly not Roadtrip (Corendon). Name check alone.
  if (FLY_AND_GO_NAME.test(name) && !FLY_AND_DRIVE_NAME.test(name)) {
    return false;
  }

  return FLY_AND_DRIVE_NAME.test(name);
}

/** Alias used by Results filtering / UI semantics. */
export function isRoadtripOffer(offer: {
  provider?: string;
  hotelName?: string;
  hasCarRental?: boolean;
}): boolean {
  return isProvenFlyAndDriveRondreis(offer);
}

/** Convenience: proven Roadtrip helper never reads hasCarRental as authority. */
export function offerHasCarRentalIsNotRondreisProof(offer: TravelOffer): boolean {
  return offer.hasCarRental === true && !isProvenFlyAndDriveRondreis(offer);
}
