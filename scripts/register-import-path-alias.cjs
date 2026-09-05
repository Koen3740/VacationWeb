/**
 * Node does not resolve TypeScript `paths` (`@/*`).
 * Import CLI scripts compile with tsconfig.import.json (`outDir: dist/import`)
 * then run via `node`, so emitted `require("@/...")` must map onto the emit tree.
 */
const path = require('node:path');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..');
const importOutDir = path.join(projectRoot, 'dist', 'import');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithImportAlias(
  request,
  parent,
  isMain,
  options,
) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(importOutDir, request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
