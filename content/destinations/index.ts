import { albanie } from '@/content/destinations/albanie';
import { DISCOVERY_CARD_DESTINATIONS } from '@/content/destinations/discovery-cards';
import { validateDestinationCollection } from '@/content/destinations/schema';
import type { DestinationDocument } from '@/content/destinations/types';

/**
 * How to add a destination
 * -----------------------
 * 1. Copy `content/destinations/albanie.ts` to `content/destinations/<slug>.ts`.
 * 2. Fill texts, chapters, facts (with source URL), images (credit + licence)
 *    and map every place to a catalog country / region / city.
 * 3. Import it here and append it to `DESTINATIONS`.
 * 4. Run the schema test. A place or region we do not sell will not get a
 *    results link; a chip or card that points nowhere fails validation.
 * Discovery and the destination template both read this collection.
 */
export const DESTINATIONS: readonly DestinationDocument[] = [albanie, ...DISCOVERY_CARD_DESTINATIONS];

export const DISCOVERY_UPDATED_LABEL = 'vr 9 okt';

const collectionErrors = validateDestinationCollection(DESTINATIONS);
if (collectionErrors.length > 0) {
  throw new Error(`Destination collection is invalid:\n${collectionErrors.join('\n')}`);
}

export function getDestination(slug: string): DestinationDocument | undefined {
  return DESTINATIONS.find((destination) => destination.slug === slug);
}

export function listLongreads(): DestinationDocument[] {
  return DESTINATIONS.filter((destination) => destination.longread);
}
