#!/usr/bin/env node
/**
 * Verify that Sucrase ships in the production bundle.
 *
 * Sucrase must be present in the prod bundle because mountBuiltinUserApps()
 * is called unconditionally at startup (not behind import.meta.env.DEV),
 * which calls compileTsx(), which dynamically imports sucrase.
 *
 * Markers used (string literals inside Sucrase that survive minification):
 *   - jsxPragma            — JSX option name in Sucrase's transform options
 *   - react-hot-loader     — transform name recognised by Sucrase
 *   - interopRequireWild   — CJS interop helper prefix emitted by Sucrase
 *
 * Note: Sucrase is bundled as a dynamic import chunk by Vite/Rolldown.
 * Class names like CJSImportProcessor get minified, but the above string
 * literals appear verbatim in the bundle.
 *
 * If this script fails, Sucrase is being DCE'd. Check that
 * mountBuiltinUserApps() is called outside any import.meta.env.DEV gate
 * in App.tsx.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIST_DIR = new URL('../dist/assets', import.meta.url).pathname;
const MARKERS = ['jsxPragma', 'react-hot-loader', 'interopRequireWild'];

let files;
try {
  files = readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
} catch (err) {
  console.error(`ERROR: Could not read dist/assets/. Did you run pnpm build first?\n${err.message}`);
  process.exit(1);
}

let foundChunk = null;

for (const file of files) {
  const content = readFileSync(join(DIST_DIR, file), 'utf8');
  const allFound = MARKERS.every((marker) => content.includes(marker));
  if (allFound) {
    foundChunk = file;
    break;
  }
}

if (!foundChunk) {
  console.error(
    `FAIL — Sucrase NOT found in production bundle.\n` +
    `Searched ${files.length} JS chunk(s) in dist/assets/ for all of:\n` +
    MARKERS.map((m) => `  - ${m}`).join('\n') +
    `\n\nFix: ensure mountBuiltinUserApps() is called outside any import.meta.env.DEV gate in App.tsx.`,
  );
  process.exit(1);
}

console.log(`OK — Sucrase found in ${foundChunk}`);
