/**
 * Short destination highlights for Destination Page.
 * Sourced from existing Discover teasers / gallery intros — not long AI blog copy.
 */
export const DESTINATION_HIGHLIGHTS: Readonly<Record<string, readonly string[]>> = {
  albania: [
    'Bergen en Ionische baaien in één land',
    'Historische steden zoals Gjirokastër en Berat',
    'Heldere wateren bij Ksamil en de Blue Eye',
  ],
  sicily: [
    'Witte kliffen van de Scala dei Turchi',
    'Griekse tempels en uitzicht op de Etna',
    'Dorpen en kustplaatsen met eigen karakter',
  ],
  crete: [
    'Iconische lagunes zoals Balos',
    'Paleizen, kloven en wilde stranden',
    'Meer dan alleen zon en zee',
  ],
  sardinia: [
    'Smaragdgroene baaien en witte duinen',
    'Eeuwenoude nuraghi en ruige kliffen',
    'Puur, wild en onvergetelijk',
  ],
};

export function getDestinationHighlights(destinationId: string): readonly string[] {
  return DESTINATION_HIGHLIGHTS[destinationId] ?? [];
}