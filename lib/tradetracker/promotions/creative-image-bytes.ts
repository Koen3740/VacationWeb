export const CREATIVE_IMAGE_MAX_BYTES = 5_000_000;

export type InspectedCreativeImage = {
  ext: 'png' | 'jpg' | 'gif' | 'webp';
  contentType: string;
  width: number;
  height: number;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function gifSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 10) {
    return null;
  }
  const header = bytes.toString('ascii', 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return null;
  }
  const width = bytes.readUInt16LE(6);
  const height = bytes.readUInt16LE(8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return null;
    }
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function webpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const width = 1 + ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16));
    const height = 1 + ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (chunk === 'VP8 ') {
    const signature = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
    if (signature >= 0 && bytes.length >= signature + 7) {
      const width = bytes.readUInt16LE(signature + 3) & 0x3fff;
      const height = bytes.readUInt16LE(signature + 5) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
  }
  return null;
}

function expectedExt(contentType: string): InspectedCreativeImage['ext'] | null {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'image/png') return 'png';
  if (base === 'image/jpeg' || base === 'image/jpg') return 'jpg';
  if (base === 'image/gif') return 'gif';
  if (base === 'image/webp') return 'webp';
  return null;
}

/** Accept only a real image whose magic bytes, content type, and dimensions agree. */
export function inspectCreativeImage(bytes: Buffer, contentType: string): InspectedCreativeImage | null {
  if (bytes.byteLength === 0 || bytes.byteLength > CREATIVE_IMAGE_MAX_BYTES) {
    return null;
  }
  const ext = expectedExt(contentType);
  if (!ext) {
    return null;
  }
  const size =
    ext === 'png' ? pngSize(bytes) : ext === 'jpg' ? jpegSize(bytes) : ext === 'gif' ? gifSize(bytes) : webpSize(bytes);
  if (!size) {
    return null;
  }
  const canonicalType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return { ext, contentType: canonicalType, width: size.width, height: size.height };
}
