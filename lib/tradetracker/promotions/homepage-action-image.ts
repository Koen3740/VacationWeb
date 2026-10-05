import fs from 'node:fs/promises';
import path from 'node:path';

/** Own copies of the Corendon homepage HPTO files. Not catalog storage. */
export const HOMEPAGE_ACTION_IMAGE_DIR = path.join('data', 'tradetracker-creatives', 'homepage-actions');

const FILES: Record<string, string> = {
  'warme-winter-weken-780x320.png': 'image/png',
  'last-minutes-oktober-november-780x320.png': 'image/png',
};

export function homepageActionImageContentType(fileName: string): string | null {
  return FILES[fileName] ?? null;
}

export async function readHomepageActionImage(
  fileName: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const contentType = homepageActionImageContentType(fileName);
  if (!contentType || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return null;
  }
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), HOMEPAGE_ACTION_IMAGE_DIR, fileName));
    return { bytes, contentType };
  } catch {
    return null;
  }
}
