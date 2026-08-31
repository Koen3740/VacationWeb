import { createHash } from 'node:crypto';

/** Compact UTC stamp: 20260821T142158Z */
export function utcCompactTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

export function sha256HexBytes(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Dataset/publish generation id: g{UTC compact}-{12 hex of sha256(catalog.json)}
 * Not an offer id, externalId, or UUID.
 */
export function buildGenerationId(
  catalogJson: string | Buffer,
  date = new Date(),
): string {
  const digest = sha256HexBytes(catalogJson).slice(0, 12);
  return `g${utcCompactTimestamp(date)}-${digest}`;
}
