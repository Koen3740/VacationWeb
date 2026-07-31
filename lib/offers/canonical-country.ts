const COUNTRY_ALIASES: Record<string, string> = {
  Albanie: 'Albanië',
  Brazilie: 'Brazilië',
  Curacao: 'Curaçao',
  Ijsland: 'IJsland',
  Indonesie: 'Indonesië',
  Italie: 'Italië',
  Kaapverdië: 'Kaapverdische Eilanden',
  Kroatie: 'Kroatië',
  Slovenie: 'Slovenië',
  Tsjechie: 'Tsjechië',
  Tunesie: 'Tunesië',
};

export function canonicalizeCountryName(name: string): string {
  if (!name) {
    return name;
  }

  return COUNTRY_ALIASES[name] ?? name;
}
