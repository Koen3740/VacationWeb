import fs from 'node:fs';
import path from 'node:path';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import { StoredOffer } from '@/lib/feeds/types/stored-offer';
import { isVacationWebFlightPackage } from '@/lib/offers/flight-package-eligibility';
import { getOffersObject } from '@/lib/storage/object-storage-client';
import { TravelOffer } from '@/types/travel';

// Runtime-only in-memory cache for the current Node.js process.
// Cloudflare R2 remains the Single Source of Truth; this cache avoids repeated
// R2 reads, JSON parsing, and normalization within the same server lifetime.
let cachedOffers: TravelOffer[] | null = null;

function parseStoredOffers(raw: string): StoredOffer[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Object Storage offers dataset is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Object Storage offers dataset must be a JSON array');
  }

  if (parsed.length === 0) {
    throw new Error('Object Storage offers dataset must contain at least one offer');
  }

  for (const [index, offer] of parsed.entries()) {
    if (typeof offer !== 'object' || offer === null) {
      throw new Error(`Object Storage offers dataset contains invalid offer at index ${index}`);
    }

    const record = offer as Record<string, unknown>;

    if (typeof record.externalId !== 'string' || record.externalId.trim() === '') {
      throw new Error(`Object Storage offers dataset missing externalId at index ${index}`);
    }

    if (typeof record.provider !== 'string' || record.provider.trim() === '') {
      throw new Error(`Object Storage offers dataset missing provider at index ${index}`);
    }

    if (typeof record.country !== 'string' || record.country.trim() === '') {
      throw new Error(`Object Storage offers dataset missing country at index ${index}`);
    }

    if (typeof record.price !== 'number') {
      throw new Error(`Object Storage offers dataset missing price at index ${index}`);
    }
  }

  return parsed as StoredOffer[];
}

function resolveLocalOffersOverride(): string | undefined {
  const override = process.env.VACATIONWEB_OFFERS_FILE?.trim();
  if (!override) {
    return undefined;
  }

  return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
}

async function readOffersRaw(): Promise<string> {
  const localPath = resolveLocalOffersOverride();
  if (localPath) {
    if (!fs.existsSync(localPath)) {
      throw new Error(`VACATIONWEB_OFFERS_FILE does not exist: ${localPath}`);
    }
    return fs.readFileSync(localPath, 'utf8');
  }

  return getOffersObject();
}

export async function loadOffers(): Promise<TravelOffer[]> {
  if (cachedOffers !== null) {
    return cachedOffers;
  }

  let raw: string;

  try {
    raw = await readOffersRaw();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load offers from Object Storage: ${message}`);
  }

  const storedOffers = parseStoredOffers(raw);
  cachedOffers = storedOffers.map(normalizeOffer).filter(isVacationWebFlightPackage);
  if (cachedOffers.length === 0) {
    throw new Error('Object Storage offers dataset contains no VacationWeb flight packages');
  }

  return cachedOffers;
}
