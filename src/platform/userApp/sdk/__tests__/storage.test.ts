import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import * as storage from '../storage';
import { withUserAppContext } from '../context';
import { getDB, APP_KV_STORE } from '@/platform/storage/idbStorage';

async function clearKv(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
  });
}

/**
 * Helper: invoke a storage SDK function within a user app context.
 * Each SDK call captures appId synchronously at call-entry (before any
 * await), so we only need the context to be active during the sync
 * portion of the call, which this helper guarantees.
 */
function inCtx<T>(appId: string, fn: () => Promise<T>): Promise<T> {
  return withUserAppContext(appId, fn);
}

describe('@hiphone/storage (flat)', () => {
  beforeEach(() => clearKv());

  it('set + get round-trip inside app context', async () => {
    await inCtx('todo', () => storage.set('items', [1, 2, 3]));
    const value = await inCtx('todo', () => storage.get('items'));
    expect(value).toEqual([1, 2, 3]);
  });

  it('different apps have isolated keys', async () => {
    await inCtx('a', () => storage.set('k', 'A-value'));
    await inCtx('b', () => storage.set('k', 'B-value'));
    expect(await inCtx('b', () => storage.get('k'))).toBe('B-value');
    expect(await inCtx('a', () => storage.get('k'))).toBe('A-value');
  });

  it('globalSet + globalGet use __global__ scope', async () => {
    await inCtx('todo', () => storage.globalSet('theme', 'dark'));
    expect(await inCtx('todo', () => storage.globalGet('theme'))).toBe('dark');
  });

  it('set and globalSet do not clash for the same user key', async () => {
    await inCtx('todo', () => storage.set('theme', 'per-user'));
    await inCtx('todo', () => storage.globalSet('theme', 'global'));
    expect(await inCtx('todo', () => storage.get('theme'))).toBe('per-user');
    expect(await inCtx('todo', () => storage.globalGet('theme'))).toBe('global');
  });

  it('remove removes only the specified key', async () => {
    await inCtx('todo', () => storage.set('a', 1));
    await inCtx('todo', () => storage.set('b', 2));
    await inCtx('todo', () => storage.remove('a'));
    expect(await inCtx('todo', () => storage.get('a'))).toBeUndefined();
    expect(await inCtx('todo', () => storage.get('b'))).toBe(2);
  });

  it('list returns user keys (stripping prefix)', async () => {
    await inCtx('todo', () => storage.set('items', [1]));
    await inCtx('todo', () => storage.set('draft', 'x'));
    await inCtx('todo', () => storage.globalSet('theme', 'dark'));
    const keys = await inCtx('todo', () => storage.list());
    expect((keys as string[]).sort()).toEqual(['draft', 'items']); // globalSet key excluded from list()
  });
});
