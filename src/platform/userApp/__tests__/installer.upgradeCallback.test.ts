import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import JSZip from 'jszip';
import type { InstallOptions, InstallErrorKind } from '../installer';
import { InstallError, install } from '../installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { appRegistry } from '@/platform/appRegistry';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';

async function makeZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

const helloTsx = `
import React from 'react';
export default function Hello() {
  return React.createElement('div', null, 'Hello');
}
`;

describe('installer types (P1 surface)', () => {
  it('InstallOptions has onUpgradeDetected callback shape', () => {
    const options: InstallOptions = {
      onUpgradeDetected: async ({ existing, incoming }) => {
        expect(typeof existing.id).toBe('string');
        expect(typeof existing.name).toBe('string');
        expect(typeof existing.version).toBe('string');
        expect(typeof incoming.id).toBe('string');
        expect(typeof incoming.name).toBe('string');
        expect(typeof incoming.version).toBe('string');
        return true;
      },
    };
    expect(options.onUpgradeDetected).toBeTypeOf('function');
  });

  it('user-cancelled is a valid InstallErrorKind', () => {
    const kind: InstallErrorKind = 'user-cancelled';
    const err = new InstallError(kind, 'user cancelled upgrade');
    expect(err.kind).toBe('user-cancelled');
    expect(err).toBeInstanceOf(InstallError);
  });
});

async function wipeIdb(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE],
      'readwrite',
    );
    tx.objectStore(APP_META_STORE).clear();
    tx.objectStore(APP_SRC_STORE).clear();
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('installer onUpgradeDetected callback behavior', () => {
  beforeEach(async () => {
    // Clear user apps from registry BEFORE wiping store (so we have the ids to unregister)
    const allIds = useInstalledUserAppsStore
      .getState()
      .apps.map((a) => a.id);
    for (const id of allIds) appRegistry.unregister(id);
    useInstalledUserAppsStore.setState({ apps: [] });
    await wipeIdb();
  });

  afterEach(() => {
    cleanup();
  });

  async function installFirstVersion(): Promise<void> {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'cb-app',
        name: 'CB App',
        version: '1.0.0',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);
  }

  async function buildUpgradeZip(version: string): Promise<Blob> {
    return makeZip({
      'manifest.json': JSON.stringify({
        id: 'cb-app',
        name: 'CB App',
        version,
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
  }

  it('calls onUpgradeDetected with existing + incoming versions', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    let capturedInfo: unknown = null;
    await install(v2, {
      onUpgradeDetected: (info) => {
        capturedInfo = info;
        return true;
      },
    });

    expect(capturedInfo).toMatchObject({
      existing: { id: 'cb-app', name: 'CB App', version: '1.0.0' },
      incoming: { id: 'cb-app', name: 'CB App', version: '2.0.0' },
    });
  });

  it('throws user-cancelled when callback returns false', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    let caught: unknown = null;
    try {
      await install(v2, { onUpgradeDetected: () => false });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(InstallError);
    expect((caught as InstallError).kind).toBe('user-cancelled');

    // Installed record should still be v1 (no overwrite happened)
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('1.0.0');
  });

  it('continues upgrade when callback returns true', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    const result = await install(v2, { onUpgradeDetected: () => true });
    expect(result.isUpgrade).toBe(true);

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('2.0.0');
  });

  it('does NOT call callback on first install (no existing)', async () => {
    const zip = await buildUpgradeZip('1.0.0');
    let called = false;
    await install(zip, {
      onUpgradeDetected: () => {
        called = true;
        return true;
      },
    });
    expect(called).toBe(false);
  });

  it('supports async callback (Promise<boolean>)', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    await install(v2, {
      onUpgradeDetected: async () =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    });

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('2.0.0');
  });
});
