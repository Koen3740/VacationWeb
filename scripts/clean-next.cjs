/**
 * Cross-platform wipe of the Next.js `.next` cache/output directory.
 * Used by `npm run build:clean` and `npm run dev:clean` (Governance workflow).
 * No extra dependencies — Node fs.rmSync only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write(`clean-next: removed ${nextDir}\n`);
} catch (err) {
  const code = err && err.code;
  if (code === 'ENOENT') {
    process.stdout.write(`clean-next: ${nextDir} already absent\n`);
    process.exit(0);
  }
  console.error(`clean-next: failed to remove ${nextDir}:`, err);
  process.exit(1);
}
