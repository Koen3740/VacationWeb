import fs from 'node:fs';
import path from 'node:path';
import { DISCOVER_FALLBACK_IMAGE } from './constants';

export { DISCOVER_FALLBACK_IMAGE };

function defaultExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath);
  } catch {
    return false;
  }
}

function isSafePublicImagePath(imageSrc: string): boolean {
  if (!imageSrc.startsWith('/') || imageSrc.startsWith('//')) {
    return false;
  }
  if (imageSrc.includes('..') || imageSrc.includes('\\') || imageSrc.includes('\0')) {
    return false;
  }
  return true;
}

/**
 * Resolve a Discover image to a local public path.
 * Missing or unsafe paths use the generic mood fallback (not place-truth).
 */
export function resolveDiscoverImageSrc(
  imageSrc: string,
  exists: (absolutePath: string) => boolean = defaultExists,
): string {
  if (!isSafePublicImagePath(imageSrc)) {
    return DISCOVER_FALLBACK_IMAGE;
  }

  const relativePath = imageSrc.replace(/^\//, '');
  const absolutePath = path.join(process.cwd(), 'public', relativePath);
  return exists(absolutePath) ? imageSrc : DISCOVER_FALLBACK_IMAGE;
}
