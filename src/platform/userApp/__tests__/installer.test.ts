import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { install, uninstall, loadInstalledApps, InstallError } from '../installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
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
});

describe('installer.uninstall', () => {
  beforeEach(async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    await resetIdb();
  });

  it('removes store / registry / IDB entries', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'todo', name: 'Todo', version: '1.0.0', entry: 'App.tsx',
      }),
      'App.tsx': helloTsx,
    });
    await install(zip);

    // Plant a fake app-kv row to verify it's cleared
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(APP_KV_STORE, 'readwrite');
      tx.objectStore(APP_KV_STORE).put(
        { appId: 'todo', scope: 'app', ownerId: '', userKey: 'k', value: 1 },
        'todo:k',
      );
      tx.oncomplete = () => resolve();
    });

    await uninstall('todo');

    expect(useInstalledUserAppsStore.getState().apps).toEqual([]);
    expect(appRegistry.get('todo')).toBeUndefined();

    const kvAfter = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(APP_KV_STORE, 'readonly');
      const req = tx.objectStore(APP_KV_STORE).get('todo:k');
      req.onsuccess = () => resolve(req.result);
    });
    expect(kvAfter).toBeUndefined();
  });

  it('refuses to uninstall a builtin app', async () => {
    function Stub() { return null; }
    appRegistry.register({
      id: 'settings',
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
});
