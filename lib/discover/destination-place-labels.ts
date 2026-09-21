/**
 * Visitor-facing place labels for Destination Page / gallery.
 * Keys = Destination Media Pool placeId values.
 */
export const DESTINATION_PLACE_LABELS: Readonly<Record<string, string>> = {
  'blue-eye': 'Blue Eye',
  gjirokaster: 'Gjirokastër',
  berat: 'Berat',
  theth: 'Theth',
  'lake-koman': 'Lake Koman',
  dhermi: 'Dhërmi',
  ksamil: 'Ksamil',
  himare: 'Himarë',
  llogara: 'Llogara',
  rozafa: 'Rozafa',
  taormina: 'Taormina',
  cefalu: 'Cefalù',
  'valle-templi': 'Valle dei Templi',
  'isola-bella': 'Isola Bella',
  ortigia: 'Ortigia',
  'scala-turchi': 'Scala dei Turchi',
  alcantara: 'Alcantara',
  noto: 'Noto',
  elafonissi: 'Elafonissi',
  knossos: 'Knossos',
  preveli: 'Preveli',
  vai: 'Vai',
  samaria: 'Samaria',
  falassarna: 'Falassarna',
  spinalonga: 'Spinalonga',
  balos: 'Balos',
  chania: 'Chania',
  tavolara: 'Tavolara',
  goloritze: 'Cala Goloritzé',
  'su-nuraxi': 'Su Nuraxi',
  'la-pelosa': 'La Pelosa',
  piscinas: 'Piscinas',
  'cala-luna': 'Cala Luna',
  'porto-pino': 'Porto Pino',
  'costa-smeralda': 'Costa Smeralda',
  maddalena: 'La Maddalena',
  gorropu: 'Gola di Gorropu',
};

export function destinationPlaceLabel(placeId: string | undefined): string {
  if (!placeId) return '';
  return DESTINATION_PLACE_LABELS[placeId] ?? placeId.replace(/-/g, ' ');
}