import { describe, expect, it, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// We re-import the module per test by resetting the module registry so the
// dbPromise singleton is cleared between tests.
describe('idbStorage v3 schema', () => {
  beforeEach(async () => {
    // Wipe the fake database so onupgradeneeded fires fresh
    const { indexedDB } = await import('fake-indexeddb');
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('hiPhone-storage');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    // Reset the module so the cached dbPromise singleton is cleared
    vi.resetModules();
  });

  it('creates app-meta / app-src / app-kv object stores', async () => {
    const {
      getDB,
      APP_META_STORE,
      APP_SRC_STORE,
      APP_KV_STORE,
    } = await import('../idbStorage');
    const db = await getDB();
    expect(db.objectStoreNames.contains(APP_META_STORE)).toBe(true);
    expect(db.objectStoreNames.contains(APP_SRC_STORE)).toBe(true);
    expect(db.objectStoreNames.contains(APP_KV_STORE)).toBe(true);
  });

  it('creates by-app-id index on app-kv', async () => {
    const { getDB, APP_KV_STORE, APP_KV_BY_APP_INDEX } = await import('../idbStorage');
    const db = await getDB();
    const tx = db.transaction(APP_KV_STORE, 'readonly');
    const store = tx.objectStore(APP_KV_STORE);
    expect(store.indexNames.contains(APP_KV_BY_APP_INDEX)).toBe(true);
  });

  it('does not drop legacy kv / messages / moments stores', async () => {
    const { getDB } = await import('../idbStorage');
    const db = await getDB();
    expect(db.objectStoreNames.contains('kv')).toBe(true);
    expect(db.objectStoreNames.contains('messages')).toBe(true);
    expect(db.objectStoreNames.contains('moments')).toBe(true);
  });
});
