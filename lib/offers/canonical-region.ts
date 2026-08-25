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
