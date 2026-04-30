import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  useInstalledUserAppsStore,
  type InstalledUserApp,
} from '@/platform/stores/installedUserAppsStore';
import { appStorageSet } from '@/platform/userApp/appStorage';
import { APP_KV_STORE, getDB } from '../idbStorage';
import {
  calculateAllAppStorageUsage,
  calculateAppStorageUsage,
} from '../calculateAppStorageUsage';

async function clearAppKv(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function installedApp(
  id: string,
  overrides: Partial<InstalledUserApp> = {},
): InstalledUserApp {
  return {
    id,
    name: id,
    iconDataUrl: null,
    page: 1,
    perspectiveAware: false,
    version: '1.0.0',
    installedAt: 1,
    sizeBytes: 0,
    ...overrides,
  };
}

describe('calculateAppStorageUsage', () => {
  beforeEach(async () => {
    await clearAppKv();
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('counts installed app package bytes and app-kv data bytes separately', async () => {
    useInstalledUserAppsStore.getState().replaceAll([
      installedApp('todo-app', { sizeBytes: 2048 }),
    ]);
    await appStorageSet('todo-app', 'todo-app:owner:me:items', {
      appId: 'todo-app',
      scope: 'owner',
      ownerId: 'me',
      userKey: 'items',
      value: ['a', 'b', 'c'],
    });
    await appStorageSet('other-app', 'other-app:owner:me:items', {
      appId: 'other-app',
      scope: 'owner',
      ownerId: 'me',
      userKey: 'items',
      value: ['not', 'counted'],
    });

    const usage = await calculateAppStorageUsage('todo-app');

    expect(usage.appId).toBe('todo-app');
    expect(usage.appBytes).toBe(2048);
    expect(usage.dataBytes).toBeGreaterThan(0);
    expect(usage.totalBytes).toBe(usage.appBytes + usage.dataBytes);
  });

  it('returns zeroes for an app without package or data', async () => {
    await expect(calculateAppStorageUsage('gomoku')).resolves.toEqual({
      appId: 'gomoku',
      appBytes: 0,
      dataBytes: 0,
      totalBytes: 0,
    });
  });

  it('calculates all requested app ids keyed by canonical app id', async () => {
    const result = await calculateAllAppStorageUsage(['gomoku', 'music']);

    expect(Object.keys(result).sort()).toEqual(['gomoku', 'music']);
    expect(result.gomoku.totalBytes).toBeGreaterThanOrEqual(0);
    expect(result.music.totalBytes).toBeGreaterThanOrEqual(0);
  });

  it('canonicalizes legacy dock aliases before reading usage', async () => {
    useInstalledUserAppsStore.getState().replaceAll([
      installedApp('music', { sizeBytes: 4096 }),
    ]);

    const usage = await calculateAppStorageUsage('music-dock');

    expect(usage).toEqual({
      appId: 'music',
      appBytes: 4096,
      dataBytes: 0,
      totalBytes: 4096,
    });
  });
});
