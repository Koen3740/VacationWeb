import fs from 'node:fs';
import path from 'node:path';
import { importCorendonXml } from '../lib/feeds/importers/corendon';

const xmlPath = path.join(process.cwd(), 'data', 'productfeed.xml');
const outputPath = path.join(process.cwd(), 'data', 'offers.json');

const xml = fs.readFileSync(xmlPath, 'utf8');
const offers = importCorendonXml(xml);

fs.writeFileSync(outputPath, JSON.stringify(offers, null, 2));

console.log(`✔ ${offers.length} Corendon-aanbiedingen geïmporteerd`);
console.log('Gebruik npm run import:feeds om alle providers samen te voegen.');
