import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { install, type InstallProgressEvent } from '../installer';
import { makeTestZip } from '../devInstall';
import { appRegistry } from '@/platform/appRegistry';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { getDB, APP_META_STORE, APP_SRC_STORE, APP_KV_STORE } from '@/platform/storage/idbStorage';

async function clearAppStores(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction([APP_META_STORE, APP_SRC_STORE, APP_KV_STORE], 'readwrite');
    tx.objectStore(APP_META_STORE).clear();
    tx.objectStore(APP_SRC_STORE).clear();
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
  });
}

describe('installer.install — progress events', () => {
  beforeEach(async () => {
    await clearAppStores();
    useInstalledUserAppsStore.setState({ apps: [] });
    // Clear any previously registered user apps by unregistering known ids.
    // Builtin apps are left alone.
    for (const entry of appRegistry.list()) {
      if (entry.type === 'user') appRegistry.unregister(entry.id);
    }
  });

  it('emits progress events in the order: unzip → validate → compile → persist → done', async () => {
    const zip = await makeTestZip('todo');
    const events: InstallProgressEvent[] = [];
    await install(zip, { onProgress: (ev) => events.push(ev) });

    const stages = events.map((e) => e.stage);
    expect(stages).toContain('unzip');
    expect(stages).toContain('validate');
    expect(stages).toContain('compile');
    expect(stages).toContain('persist');
    expect(stages[stages.length - 1]).toBe('done');

    // Order invariant: indexOf of each stage is strictly monotonic
    const order: InstallProgressEvent['stage'][] = ['unzip', 'validate', 'compile', 'persist', 'done'];
    let lastIdx = -1;
    for (const stage of order) {
      const idx = stages.indexOf(stage);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('each event progress is in [0, 1]', async () => {
    const zip = await makeTestZip('todo');
    const events: InstallProgressEvent[] = [];
    await install(zip, { onProgress: (ev) => events.push(ev) });
    for (const ev of events) {
      if ('progress' in ev && ev.progress !== undefined) {
        expect(ev.progress).toBeGreaterThanOrEqual(0);
        expect(ev.progress).toBeLessThanOrEqual(1);
      }
    }
  });

  it('compile events include fileIndex/total', async () => {
    const zip = await makeTestZip('todo');
    const events: InstallProgressEvent[] = [];
    await install(zip, { onProgress: (ev) => events.push(ev) });
    const compileEvents = events.filter((e): e is Extract<InstallProgressEvent, { stage: 'compile' }> => e.stage === 'compile');
    expect(compileEvents.length).toBeGreaterThan(0);
    for (const ev of compileEvents) {
      expect(ev.total).toBeGreaterThanOrEqual(1);
      expect(ev.fileIndex).toBeGreaterThanOrEqual(0);
      expect(ev.fileIndex).toBeLessThanOrEqual(ev.total);
    }
  });

  it('emits an error event when zip is corrupted', async () => {
    const badZip = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'application/zip' });
    const events: InstallProgressEvent[] = [];
    await expect(install(badZip, { onProgress: (ev) => events.push(ev) })).rejects.toThrow();
    const errorEvents = events.filter((e): e is Extract<InstallProgressEvent, { stage: 'error' }> => e.stage === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0]!.error).toBeInstanceOf(Error);
  });

  it('install still returns a valid result when onProgress is not passed', async () => {
    const zip = await makeTestZip('todo');
    const result = await install(zip);
    expect(result.id).toBe('test-todo');
    expect(result.installedAt).toBeGreaterThan(0);
  });
});
