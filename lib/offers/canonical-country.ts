const COUNTRY_ALIASES: Record<string, string> = {
  Albanie: 'Albanië',
  Brazilie: 'Brazilië',
  Bulgarie: 'Bulgarije',
  Curacao: 'Curaçao',
  Chypre: 'Cyprus',
  Espagne: 'Spanje',
  Grece: 'Griekenland',
  'Grèce': 'Griekenland',
  Ijsland: 'IJsland',
  Indonesie: 'Indonesië',
  Italie: 'Italië',
  Kaapverdië: 'Kaapverdische Eilanden',
  Kroatie: 'Kroatië',
  Maroc: 'Marokko',
  Slovenie: 'Slovenië',
  Tsjechie: 'Tsjechië',
  Tunesie: 'Tunesië',
  Tunisie: 'Tunesië',
  Turquie: 'Turkije',
};

export function canonicalizeCountryName(name: string): string {
  if (!name) {
    return name;
  }

  return COUNTRY_ALIASES[name] ?? name;
}
