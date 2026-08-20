const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: '\u00A0',
};

/**
 * Single-pass HTML entity decode for catalog text (hotel names).
 * Leaves already-decoded Unicode, real `&`, and accented letters unchanged.
 */
export function decodeHtmlEntities(value: string): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (!text.includes('&')) {
    return text;
  }

  return text.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g,
    (entity, body: string) => {
      if (body.startsWith('#')) {
        const codePoint =
          body[1] === 'x' || body[1] === 'X'
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
          return entity;
        }
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }

      return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    },
  );
}
