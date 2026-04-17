import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build an in-memory Blob of a user app zip from a fixture directory.
 * Node-only (uses fs) — runs in vitest with jsdom.
 */
export async function loadFixtureZip(fixtureName: string): Promise<Blob> {
  const root = resolve(__dirname, fixtureName);

  const collect = (dir: string, prefix: string): Array<{ path: string; content: Buffer }> => {
    const out: Array<{ path: string; content: Buffer }> = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...collect(full, rel));
      } else {
        out.push({ path: rel, content: readFileSync(full) });
      }
    }
    return out;
  };

  const files = collect(root, '');
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  return zip.generateAsync({ type: 'blob' });
}
