/**
 * Regenerates data/destination-directory.json (M1 destination directory) from the local catalog.
 * Reads data/offers.json (or VACATIONWEB_OFFERS_FILE), never writes the catalog, R2 or live pricing.
 *   npx tsx scripts/build-destination-directory.ts [--check]
 * --check: exit 1 when the stored directory differs from the catalog (new/removed destinations).
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildDestinationDirectory } from '../lib/search/destination-directory';

const root = path.join(__dirname, '..');
const offersPath = process.env.VACATIONWEB_OFFERS_FILE?.trim() || path.join(root, 'data', 'offers.json');
const target = path.join(root, 'data', 'destination-directory.json');

const stored = JSON.parse(fs.readFileSync(offersPath, 'utf8')) as Array<{
  country: string;
  region?: string;
  province?: string;
  city?: string;
}>;
const directory = buildDestinationDirectory(
  stored.map((offer) => ({
    country: offer.country,
    region: offer.region,
    province: offer.province,
    city: offer.city,
  })),
);
const json = `${JSON.stringify(directory, null, 1)}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current.replace(/\r\n/g, '\n') !== json) {
    console.error('destination-directory.json is out of date with the catalog');
    process.exit(1);
  }
  console.log('destination-directory.json is up to date');
} else {
  fs.writeFileSync(target, json, 'utf8');
  console.log(
    `wrote ${target}: ${directory.countries.length} countries, ${directory.areas.length} areas, ${directory.places.length} places (${directory.offers} offers)`,
  );
}
