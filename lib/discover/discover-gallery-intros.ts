export const DISCOVER_DESTINATION_GALLERY_INTROS: Readonly<
  Record<string, string>
> = {
  albania:
    'Van de Albanese Alpen tot de Ionische kust: berglandschappen, historische steden en helderblauwe baaien.',
  sicily:
    'Witte kliffen, Griekse tempels en uitzicht op de Etna: Sicilië voelt op elke plek anders.',
  crete:
    'Van de lagune van Balos tot paleizen en wilde kloven: Kreta verrast ver voorbij het strand.',
  sardinia:
    'Witte duinen, smaragdgroene baaien en eeuwenoude nuraghi: Sardinië op zijn puurst.',
};

export function getDiscoverGalleryIntro(destinationId: string): string {
  return (
    DISCOVER_DESTINATION_GALLERY_INTROS[destinationId] ??
    'Ontdek de landschappen, plaatsen en verhalen die deze bestemming bijzonder maken.'
  );
}
