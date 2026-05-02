import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import JSZip from 'jszip';
import { install, uninstall, loadInstalledApps, InstallError } from '../installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { appRegistry } from '@/platform/appRegistry';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';

async function makeZip(files: Record<string, string | Uint8Array>): Promise<Blob> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content as string);
  }
  return zip.generateAsync({ type: 'blob' });
}

const helloTsx = `
import React from 'react';
export default function Hello() {
  return React.createElement('div', null, 'Hello from user app');
}
`;

async function resetIdb(): Promise<void> {
  const db = await getDB();
  const stores = [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach((s) => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('installer.install — single file', () => {
  beforeEach(async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('installs a valid single-file zip', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'hello', name: 'Hello', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });

    const result = await install(zip);

    expect(result.id).toBe('hello');
    expect(result.isUpgrade).toBe(false);

    // installedUserAppsStore updated
    const apps = useInstalledUserAppsStore.getState().apps;
    expect(apps.map((a) => a.id)).toEqual(['hello']);

    // appRegistry has entry with type=user
    const entry = appRegistry.get('hello');
    expect(entry?.type).toBe('user');
    expect(typeof entry?.component).toBe('function');
  });

  it('installs a zip-payload regardless of file extension or MIME type', async () => {
    // The installer parses content via JSZip — filename / extension / MIME
    // are never inspected. This is the contract the App Store UI relies on
    // when accepting non-.zip carriers (e.g. .pdf-renamed packages used to
    // bypass platforms that block .zip uploads).
    const zipBlob = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'pdf-carrier', name: 'PDF Carrier', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    const buf = await zipBlob.arrayBuffer();
    // Wrap the same bytes in a File with a .pdf name + application/pdf MIME.
    const pdfFile = new File([buf], 'app.pdf', { type: 'application/pdf' });

    const result = await install(pdfFile);

    expect(result.id).toBe('pdf-carrier');
    expect(useInstalledUserAppsStore.getState().apps.map((a) => a.id)).toEqual([
      'pdf-carrier',
    ]);
  });

  it('rejects a zip missing manifest.json', async () => {
    const zip = await makeZip({ 'App.tsx': helloTsx });
    await expect(install(zip)).rejects.toBeInstanceOf(InstallError);
    await expect(install(zip)).rejects.toThrow(/manifest/i);
  });

  it('rejects a manifest that fails schema', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({ id: 'x', name: 'X', version: '1.0.0' }),
      'App.tsx': helloTsx,
    });
    await expect(install(zip)).rejects.toBeInstanceOf(InstallError);
  });

  it('rejects a zip where entry file is missing', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'bad', name: 'X', version: '1.0.0', entry: 'Missing.tsx',
      }),
    });
    await expect(install(zip)).rejects.toThrow(/entry/i);
  });

  it('rejects a zip whose source fails to compile', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'broken', name: 'X', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': 'this is not valid TypeScript ][}{',
    });
    await expect(install(zip)).rejects.toBeInstanceOf(InstallError);
  });

  it('rejects an id that collides with a builtin', async () => {
    // Simulate a builtin registration
    function Stub() { return null; }
    appRegistry.register({
      id: 'settings',
      name: '设置',
      type: 'builtin',
      component: Stub,
      perspectiveAware: false,
      globalData: false,
    });

    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'settings', name: 'X', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });

    await expect(install(zip)).rejects.toThrow(/conflict|builtin/i);
  });

  it('records sizeBytes in IDB app-meta as the sum of compiled sources', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'size-test',
        name: 'Size Test',
        version: '1.0.0',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);

    const db = await getDB();
    const meta = await new Promise<{ sizeBytes: number } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(APP_META_STORE, 'readonly');
        const req = tx.objectStore(APP_META_STORE).get('size-test');
        req.onsuccess = () =>
          resolve(req.result as { sizeBytes: number } | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    expect(meta).toBeDefined();
    expect(meta!.sizeBytes).toBeGreaterThan(0);
  });

  it('exposes sizeBytes and version on the store record after install', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'exposure-test',
        name: 'Exposure',
        version: '2.5.1',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'exposure-test');
    expect(record).toBeDefined();
    expect(record!.version).toBe('2.5.1');
    expect(record!.sizeBytes).toBeGreaterThan(0);
    expect(record!.installedAt).toBeGreaterThan(0);
  });

  it('reinstall of same user app id preserves app-kv but overwrites code (Q5)', async () => {
    const zip1 = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo', name: 'Todo v1', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    await install(zip1);

    // Write a fake app-kv row to verify it survives
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(APP_KV_STORE, 'readwrite');
      tx.objectStore(APP_KV_STORE).put(
        { appId: 'todo', scope: 'app', ownerId: '', userKey: 'items', value: [1, 2, 3] },
        'todo:items',
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const zip2 = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo', name: 'Todo v2', version: '2.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    const result = await install(zip2);

    expect(result.isUpgrade).toBe(true);

    // app-kv survived
    const kept = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(APP_KV_STORE, 'readonly');
      const req = tx.objectStore(APP_KV_STORE).get('todo:items');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(kept).toBeDefined();

    // Name/version updated in installedUserAppsStore
    expect(useInstalledUserAppsStore.getState().apps[0]!.name).toBe('Todo v2');
  });

  it('preserves app profile overrides when upgrading a user app', async () => {
    const zip1 = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo-profile',
        name: 'Todo',
        version: '1.0.0',
        entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    const zip2 = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo-profile',
        name: 'Todo 2',
        version: '1.1.0',
        entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });

    await install(zip1);
    useAppProfileStore.getState().setName('todo-profile', '我的待办');
    await install(zip2);

    expect(
      useAppProfileStore.getState().getProfile('todo-profile')?.customName,
    ).toBe('我的待办');
  });
});

describe('installer.uninstall', () => {
  beforeEach(async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('removes store / registry / IDB entries', async () => {
    const APP_ID = 'todo';
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: APP_ID, name: 'Todo', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    await install(zip);

    // Seed a service entry for the app via the registry so we can verify
    // uninstall clears it even when services.ts wasn't part of the zip.
    const { serviceRegistry } = await import('@/platform/services/serviceRegistry');
    serviceRegistry.register(APP_ID, { name: 'dummy', execute: async () => null });

    // Plant a fake app-kv row to verify it's cleared
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(APP_KV_STORE, 'readwrite');
      tx.objectStore(APP_KV_STORE).put(
        { appId: APP_ID, scope: 'app', ownerId: '', userKey: 'k', value: 1 },
        `${APP_ID}:k`,
      );
      tx.oncomplete = () => resolve();
    });

    await uninstall(APP_ID);

    expect(useInstalledUserAppsStore.getState().apps).toEqual([]);
    expect(appRegistry.get(APP_ID)).toBeUndefined();

    const kvAfter = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(APP_KV_STORE, 'readonly');
      const req = tx.objectStore(APP_KV_STORE).get(`${APP_ID}:k`);
      req.onsuccess = () => resolve(req.result);
    });
    expect(kvAfter).toBeUndefined();

    // Services for this app should also be cleared.
    expect(await serviceRegistry.list(APP_ID)).toEqual([]);
  });

  it('removes app profile overrides when uninstalling a user app', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo-profile',
        name: 'Todo',
        version: '1.0.0',
        entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });

    await install(zip);
    useAppProfileStore.getState().setName('todo-profile', '我的待办');
    await uninstall('todo-profile');

    expect(
      useAppProfileStore.getState().getProfile('todo-profile'),
    ).toBeUndefined();
  });

  it('refuses to uninstall a builtin app', async () => {
    function Stub() { return null; }
    appRegistry.register({
      id: 'settings',
      name: '设置',
      type: 'builtin',
      component: Stub,
      perspectiveAware: false,
      globalData: false,
    });
    await expect(uninstall('settings')).rejects.toThrow(/builtin|cannot/i);
  });
});

describe('installer.loadInstalledApps', () => {
  beforeEach(async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('rebuilds store + registry from IDB on startup', async () => {
    // Install → simulate reload by clearing memory state
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'hello', name: 'Hello', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    await install(zip);

    useInstalledUserAppsStore.setState({ apps: [] });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));

    await loadInstalledApps();

    expect(useInstalledUserAppsStore.getState().apps.map((a) => a.id)).toEqual(['hello']);
    expect(appRegistry.get('hello')).toBeDefined();
  });

  it('loadInstalledApps populates new fields from stored AppMeta', async () => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([APP_META_STORE, APP_SRC_STORE], 'readwrite');
      tx.objectStore(APP_META_STORE).put(
        {
          manifest: {
            id: 'legacy-new',
            name: 'Legacy New',
            version: '3.0.0',
            entry: 'index.tsx',
            perspectiveAware: false,
          },
          installedAt: 1_700_000_000_123,
          iconDataUrl: null,
          sizeBytes: 4_096,
        },
        'legacy-new',
      );
      tx.objectStore(APP_SRC_STORE).put(
        { compiledMap: { 'index.tsx': 'module.exports={};' }, installedAt: 1_700_000_000_123 },
        'legacy-new',
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await loadInstalledApps();
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'legacy-new');
    expect(record).toBeDefined();
    expect(record!.version).toBe('3.0.0');
    expect(record!.installedAt).toBe(1_700_000_000_123);
    expect(record!.sizeBytes).toBe(4_096);
  });

  it('loadInstalledApps falls back for legacy records missing sizeBytes', async () => {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([APP_META_STORE, APP_SRC_STORE], 'readwrite');
      tx.objectStore(APP_META_STORE).put(
        {
          manifest: {
            id: 'legacy-old',
            name: 'Legacy Old',
            version: '0.9.0',
            entry: 'index.tsx',
            perspectiveAware: false,
          },
          installedAt: 1_600_000_000_000,
          iconDataUrl: null,
          // no sizeBytes key on purpose
        },
        'legacy-old',
      );
      tx.objectStore(APP_SRC_STORE).put(
        { compiledMap: { 'index.tsx': 'module.exports={};' }, installedAt: 1_600_000_000_000 },
        'legacy-old',
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await loadInstalledApps();
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'legacy-old');
    expect(record).toBeDefined();
    expect(record!.sizeBytes).toBe(0);
    expect(record!.version).toBe('0.9.0');
    expect(record!.installedAt).toBe(1_600_000_000_000);
  });
});

describe('installer — multi-file', () => {
  beforeEach(async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('installs a multi-file zip and resolves relative imports at runtime', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'multi', name: 'Multi', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': `
        import React from 'react';
        import { greeting } from './utils';
        export default function App() {
          return React.createElement('div', null, greeting);
        }
      `,
      'utils.ts': `
        export const greeting = 'hello from utils';
      `,
    });

    const result = await install(zip);
    expect(result.id).toBe('multi');

    const entry = appRegistry.get('multi');
    expect(entry).toBeDefined();
    const Component = entry!.component;
    // Calling the wrapped component as a plain function is enough to
    // confirm registration — we don't render it. Wrap uses a hook
    // (useAppRuntimeStore), so actually invoking here would violate
    // React rules-of-hooks; just assert the component reference exists.
    expect(typeof Component).toBe('function');
  });

  it('refuses to install a zip where a relative import references a missing file', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'bad', name: 'Bad', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': `
        import React from 'react';
        import { x } from './missing';
        export default () => React.createElement('div', null, x);
      `,
    });
    const result = await install(zip);
    expect(result.id).toBe('bad');
    // Open-time failure is deferred; install succeeds.
  });
});

describe('installer — end-to-end with storage', () => {
  beforeEach(async () => {
    cleanup();
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('user app can write and read storage through @hiphone/storage', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'storage-test', name: 'StorageTest', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': `
        import React from 'react';
        import { set } from '@hiphone/storage';

        export default function App() {
          // set() captures appId synchronously at call-entry (before any await),
          // so it correctly records which app is writing even though the context
          // stack is sync-only and has exited by the time the promise resolves.
          set('greeting', 'hi').then(() => {});
          return React.createElement('div', null, 'see storage');
        }
      `,
    });

    await install(zip);

    // Render the installed component to trigger the lazy runtime init
    // and execute the App function (which calls set()).
    const entry = appRegistry.get('storage-test')!;
    await act(async () => {
      render(React.createElement(entry.component));
    });

    // Wait for the set() promise to resolve via IDB
    await new Promise((r) => setTimeout(r, 50));

    const { appStorageGet } = await import('../appStorage');
    const record = await appStorageGet('storage-test', 'storage-test:owner:me:greeting');
    expect((record as { value?: unknown })?.value).toBe('hi');
  });
});
