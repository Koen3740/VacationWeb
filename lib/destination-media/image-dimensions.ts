import { readFileSync, existsSync } from 'node:fs';

export type ImageDimensions = { width: number; height: number };

/** Minimal JPEG/PNG dimension reader (no native deps). */
export function readImageDimensions(filePath: string): ImageDimensions | null {
  if (!existsSync(filePath)) return null;
  const buf = readFileSync(filePath);
  if (buf.length < 24) return null;

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // JPEG — scan for SOF0/SOF2
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const size = buf.readUInt16BE(i + 2);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      i += 2 + size;
    }
  }

  return null;
}

/** Gallery cards render ~4:3 up to ~400px CSS; require native master sharpness. */
export const GALLERY_MIN_WIDTH = 1600;
export const GALLERY_MIN_HEIGHT = 1100;

export function meetsGalleryResolution(
  dims: ImageDimensions | null | undefined,
): boolean {
  if (!dims) return false;
  return dims.width >= GALLERY_MIN_WIDTH && dims.height >= GALLERY_MIN_HEIGHT;
}

/** Keep only complete rows for a fixed column count (no lonely last-row cards). */
export function truncateToFullRows<T>(items: readonly T[], columns: number): T[] {
  if (columns <= 0) return [...items];
  const keep = Math.floor(items.length / columns) * columns;
  return items.slice(0, keep);
}