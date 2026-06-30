export const PROVIDERS = {
  corendon: {
    name: 'Corendon',
    slug: 'corendon',
  },
  prijsvrij: {
    name: 'Prijsvrij',
    slug: 'prijsvrij',
  },
} as const;

export type ProviderSlug = keyof typeof PROVIDERS;

export function buildExternalId(
  provider: ProviderSlug,
  rawId: string | number,
  variantParts: Array<string | number> = [],
): string {
  const parts = [PROVIDERS[provider].slug, String(rawId), ...variantParts.map(String).filter(Boolean)];
  return parts.join('-');
}

export function assertProviderName(provider: ProviderSlug, name: string): string {
  const expected = PROVIDERS[provider].name;

  if (name !== expected) {
    throw new Error(`Provider name mismatch: expected "${expected}", received "${name}"`);
  }

  return expected;
}
