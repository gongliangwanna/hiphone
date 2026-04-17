import JSZip from 'jszip';
import { install, uninstall } from './installer';

/**
 * Inline spec form: caller provides the manifest object and a map of
 * filename → content string. Returns an in-memory Blob suitable for
 * passing to `install()`.
 */
export interface ZipSpec {
  manifest: Record<string, unknown>;
  files: Record<string, string>;
}

export async function makeTestZip(spec: ZipSpec | 'todo'): Promise<Blob> {
  const resolved: ZipSpec = typeof spec === 'string' ? PRESETS[spec] : spec;
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(resolved.manifest));
  for (const [path, content] of Object.entries(resolved.files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

const PRESETS: Record<'todo', ZipSpec> = {
  todo: {
    manifest: {
      id: 'test-todo',
      name: '测试待办',
      version: '1.0.0',
      entry: 'App.tsx',
    },
    files: {
      'App.tsx': `
import React, { useState } from 'react';
export default function TodoApp() {
  const [items, setItems] = useState(['first', 'second']);
  return React.createElement('div', { style: { padding: 20 } },
    React.createElement('h1', null, 'Todo'),
    React.createElement('ul', null,
      items.map((it, i) => React.createElement('li', { key: i }, it))
    )
  );
}
      `,
    },
  },
};

/**
 * Attach dev API to globalThis. Caller must gate this with
 * `import.meta.env.DEV` so production builds DCE it away.
 */
export function installDevApi(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.__hiphoneInstall = (file: Blob) => install(file);
  g.__hiphoneUninstall = (appId: string) => uninstall(appId);
  g.__hiphoneMakeTestZip = makeTestZip;
}
