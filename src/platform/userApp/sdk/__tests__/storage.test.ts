import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import * as storage from '../storage';
import { withUserAppContext } from '../context';
import { getDB, APP_KV_STORE } from '@/platform/storage/idbStorage';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';

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

describe('@hiphone/storage (owner-aware)', () => {
  beforeEach(async () => {
    await clearKv();
    usePhoneOwnerStore.setState({ phoneOwnerId: null }); // player
  });

  it('set/get inside app context — player view', async () => {
    await inCtx('todo', () => storage.set('items', [1, 2]));
    const value = await inCtx('todo', () => storage.get('items'));
    expect(value).toEqual([1, 2]);
  });

  it('switching owner isolates storage per owner', async () => {
    // Player writes
    await inCtx('todo', () => storage.set('items', ['player-todo']));

    // Switch to char 001: should see empty, then write its own
    // (phoneOwnerId stores bare character IDs; SDK adds the `char-` prefix)
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' });
    expect(await inCtx('todo', () => storage.get('items'))).toBeUndefined();
    await inCtx('todo', () => storage.set('items', ['char-todo']));

    // Switch back to player: should see original player value
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    expect(await inCtx('todo', () => storage.get('items'))).toEqual(['player-todo']);
  });

  it('globalSet is shared across owners', async () => {
    await inCtx('todo', () => storage.globalSet('theme', 'dark'));

    usePhoneOwnerStore.setState({ phoneOwnerId: '001' });
    expect(await inCtx('todo', () => storage.globalGet('theme'))).toBe('dark');
  });

  it('list returns only per-owner keys for current owner', async () => {
    // Player sets two keys + one global
    await inCtx('todo', () => storage.set('a', 1));
    await inCtx('todo', () => storage.set('b', 2));
    await inCtx('todo', () => storage.globalSet('theme', 'dark'));

    // Player list: only per-owner keys, not global
    const playerKeys = await inCtx('todo', () => storage.list());
    expect((playerKeys as string[]).sort()).toEqual(['a', 'b']);

    // Char-001 list: empty (no per-owner data yet)
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' });
    const charKeys = await inCtx('todo', () => storage.list());
    expect(charKeys).toEqual([]);
  });

  it('remove removes only the current owner version', async () => {
    // Player writes key 'k'
    await inCtx('todo', () => storage.set('k', 'player'));

    // Char-001 writes key 'k', then removes it
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' });
    await inCtx('todo', () => storage.set('k', 'char'));
    await inCtx('todo', () => storage.remove('k'));
    expect(await inCtx('todo', () => storage.get('k'))).toBeUndefined();

    // Switch back to player: player's 'k' should be intact
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    expect(await inCtx('todo', () => storage.get('k'))).toBe('player');
  });
});
