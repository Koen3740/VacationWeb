import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

export const FEED_PATHS = {
  corendon: path.join(DATA_DIR, 'productfeed.xml'),
  prijsvrij: path.join(DATA_DIR, 'prijsvrij.xml'),
  offers: path.join(DATA_DIR, 'offers.json'),
  filterOptions: path.join(DATA_DIR, 'filter-options.json'),
} as const;
