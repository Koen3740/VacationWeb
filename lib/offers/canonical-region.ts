/**
 * Region display aliases proven by coexisting Dutch labels in the VacationWeb catalog.
 * Unknown names are left unchanged. Do not invent geography.
 */
const REGION_ALIASES: Record<string, string> = {
  Andalusie: 'Andalusië',
  'Côte Égéenne': 'Egeïsche Kust',
  'Cote Egeenne': 'Egeïsche Kust',
  'Egeische Kust': 'Egeïsche Kust',
  'Egeische kust': 'Egeïsche Kust',
  'Maroc central': 'Centraal Marokko',
  'Riviera Turque': 'Turkse Riviera',
  'Turkse Rivièra': 'Turkse Riviera',
  'Îles Canaries': 'Canarische Eilanden',
  'Iles Canaries': 'Canarische Eilanden',
  // M1 (2026-10-02): provider-language variants proven in the catalog (same area, other language).
  Majorque: 'Mallorca',
  'Crète': 'Kreta',
  'Zakynthos (Zante)': 'Zakynthos',
  Santorin: 'Santorini',
  'Madère': 'Madeira',
  Chalcidique: 'Chalkidiki',
  Chypre: 'Cyprus',
  'Mer Rouge': 'Rode Zee',
  'La Riviera Turque': 'Turkse Riviera',
  'Côte Egéenne': 'Egeïsche Kust',
  Curacao: 'Curaçao',
  'Costa De Almeria': 'Costa de Almería',
  'Costa De La Luz': 'Costa de la Luz',
  'Golf Van Hammamet': 'Golf van Hammamet',
};

export function canonicalizeRegionName(name: string | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    return trimmed;
  }

  return REGION_ALIASES[trimmed] ?? trimmed;
}
