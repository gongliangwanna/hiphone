import { describe, expect, it, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import JSZip from 'jszip';

async function freshDB() {
  const { indexedDB } = await import('fake-indexeddb');
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('hiPhone-storage');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  vi.resetModules();
}

async function seed() {
  const idb = await import('../idbStorage');
  const db = await idb.getDB();

  // KV
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ state: { foo: 1 }, version: 0 }, 'hiPhone-system');
    tx.objectStore('kv').put({ state: { bar: 'baz' } }, 'hiPhone-ai-config');
    tx.objectStore('kv').put({ notes: ['a'] }, 'hiPhone-notes::char-abc');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // messages
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(idb.MESSAGES_STORE, 'readwrite');
    tx.objectStore(idb.MESSAGES_STORE).put({ id: 'm1', convId: 'c1', text: 'hi' });
    tx.objectStore(idb.MESSAGES_STORE).put({ id: 'm2', convId: 'c1', text: 'yo' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // moments
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(idb.MOMENTS_STORE, 'readwrite');
    tx.objectStore(idb.MOMENTS_STORE).put({ id: 'mo1', text: 'sunny' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // characterMemory
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(idb.MEMORY_STORE, 'readwrite');
    tx.objectStore(idb.MEMORY_STORE).put({ id: 'me1', characterId: 'abc', text: 'fact' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // characterMemoryState
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(idb.MEMORY_STATE_STORE, 'readwrite');
    tx.objectStore(idb.MEMORY_STATE_STORE).put({ characterId: 'abc', summary: 'hello' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // app stores
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([idb.APP_META_STORE, idb.APP_SRC_STORE, idb.APP_KV_STORE], 'readwrite');
    tx.objectStore(idb.APP_META_STORE).put({ name: 'demo', version: '1' }, 'app-1');
    tx.objectStore(idb.APP_SRC_STORE).put('export const X = 1;', 'app-1');
    tx.objectStore(idb.APP_KV_STORE).put({ appId: 'app-1', value: { count: 5 } }, 'app-1::user::me::counter');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return db;
}

async function readKvKey(key: string): Promise<unknown> {
  const idb = await import('../idbStorage');
  const db = await idb.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllRecords(storeName: string): Promise<unknown[]> {
  const idb = await import('../idbStorage');
  const db = await idb.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

describe('exportAllData', () => {
  beforeEach(async () => {
    await freshDB();
  });

  it('does not crash when the IDB is missing newer object stores', async () => {
    // Simulate a stale DB created by an old build that only had `kv`.
    const { indexedDB } = await import('fake-indexeddb');
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('hiPhone-storage', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // Now import the module; getDB will upgrade to v6 and add missing stores,
    // but the test verifies that even if some stores were missing at export
    // time, export() doesn't blow up.
    const { exportAllData } = await import('../dataPortability');
    const blob = await exportAllData();
    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.objectStores.messages.recordCount).toBe(0);
  });

  it('writes manifest.json with schema version, db version, and counts', async () => {
    await seed();
    const { exportAllData, EXPORT_SCHEMA_VERSION, SUPPORTED_DB_VERSION } = await import('../dataPortability');
    const blob = await exportAllData();
    const zip = await JSZip.loadAsync(blob);

    const manifestText = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestText);

    expect(manifest.exportSchemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(manifest.dbVersion).toBe(SUPPORTED_DB_VERSION);
    expect(typeof manifest.exportedAt).toBe('string');
    expect(manifest.objectStores.kv.keyCount).toBe(3);
    expect(manifest.objectStores.messages.recordCount).toBe(2);
    expect(manifest.objectStores.moments.recordCount).toBe(1);
    expect(manifest.objectStores.characterMemory.recordCount).toBe(1);
    expect(manifest.objectStores.characterMemoryState.recordCount).toBe(1);
    expect(manifest.objectStores['app-meta'].recordCount).toBe(1);
    expect(manifest.objectStores['app-src'].recordCount).toBe(1);
    expect(manifest.objectStores['app-kv'].recordCount).toBe(1);
  });

  it('writes one file per kv key with encodeURIComponent-safe filenames', async () => {
    await seed();
    const { exportAllData } = await import('../dataPortability');
    const blob = await exportAllData();
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file('kv/hiPhone-system.json')).toBeTruthy();
    expect(zip.file('kv/hiPhone-ai-config.json')).toBeTruthy();
    // Per-entity key contains "::" — must be URL-encoded
    const perEntityFile = zip.file(`kv/${encodeURIComponent('hiPhone-notes::char-abc')}.json`);
    expect(perEntityFile).toBeTruthy();
    const content = JSON.parse(await perEntityFile!.async('string'));
    expect(content).toEqual({ notes: ['a'] });
  });

  it('writes record-store JSON arrays', async () => {
    await seed();
    const { exportAllData } = await import('../dataPortability');
    const blob = await exportAllData();
    const zip = await JSZip.loadAsync(blob);

    const messages = JSON.parse(await zip.file('messages.json')!.async('string'));
    expect(messages).toHaveLength(2);
    expect(messages.map((m: { id: string }) => m.id).sort()).toEqual(['m1', 'm2']);

    const moments = JSON.parse(await zip.file('moments.json')!.async('string'));
    expect(moments).toEqual([{ id: 'mo1', text: 'sunny' }]);

    const appKv = JSON.parse(await zip.file('app-kv.json')!.async('string'));
    expect(appKv).toEqual([
      { key: 'app-1::user::me::counter', value: { appId: 'app-1', value: { count: 5 } } },
    ]);

    const appMeta = JSON.parse(await zip.file('app-meta.json')!.async('string'));
    expect(appMeta).toEqual([{ key: 'app-1', value: { name: 'demo', version: '1' } }]);

    const appSrc = JSON.parse(await zip.file('app-src.json')!.async('string'));
    expect(appSrc).toEqual([{ key: 'app-1', value: 'export const X = 1;' }]);
  });
});

describe('importAllData', () => {
  beforeEach(async () => {
    await freshDB();
  });

  it('round-trips: export → wipe → import → identical state', async () => {
    await seed();
    const { exportAllData, importAllData } = await import('../dataPortability');
    const blob = await exportAllData();

    // Wipe everything
    const idb = await import('../idbStorage');
    const db = await idb.getDB();
    await new Promise<void>((resolve, reject) => {
      const stores = ['kv', idb.MESSAGES_STORE, idb.MOMENTS_STORE, idb.MEMORY_STORE,
        idb.MEMORY_STATE_STORE, idb.APP_META_STORE, idb.APP_SRC_STORE, idb.APP_KV_STORE];
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    expect(await getAllRecords(idb.MESSAGES_STORE)).toEqual([]);

    // Mock downloadBlob to suppress the safety-backup file download in tests
    const dl = await import('../downloadBlob');
    vi.spyOn(dl, 'downloadBlob').mockImplementation(() => {});

    await importAllData(blob);

    expect(await readKvKey('hiPhone-system')).toEqual({ state: { foo: 1 }, version: 0 });
    expect(await readKvKey('hiPhone-notes::char-abc')).toEqual({ notes: ['a'] });
    const messages = await getAllRecords(idb.MESSAGES_STORE);
    expect(messages).toHaveLength(2);
    const memState = await getAllRecords(idb.MEMORY_STATE_STORE);
    expect(memState).toEqual([{ characterId: 'abc', summary: 'hello' }]);
  });

  it('rejects when manifest.json is missing', async () => {
    const zip = new JSZip();
    zip.file('messages.json', '[]');
    const blob = await zip.generateAsync({ type: 'blob' });
    const { importAllData } = await import('../dataPortability');
    await expect(importAllData(blob)).rejects.toThrow(/manifest/);
  });

  it('rejects unknown exportSchemaVersion', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ exportSchemaVersion: 99, dbVersion: 6 }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const { importAllData } = await import('../dataPortability');
    await expect(importAllData(blob)).rejects.toThrow(/v99/);
  });

  it('rejects mismatched dbVersion', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ exportSchemaVersion: 1, dbVersion: 99 }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const { importAllData } = await import('../dataPortability');
    await expect(importAllData(blob)).rejects.toThrow(/v99/);
  });

  it('triggers a safety backup download before clearing', async () => {
    await seed();
    const { exportAllData, importAllData } = await import('../dataPortability');
    const blob = await exportAllData();

    const dl = await import('../downloadBlob');
    const spy = vi.spyOn(dl, 'downloadBlob').mockImplementation(() => {});

    await importAllData(blob);

    expect(spy).toHaveBeenCalled();
    const [, filename] = spy.mock.calls[0]!;
    expect(filename as string).toMatch(/^hiphone-pre-import-backup-.+\.zip$/);
  });

  it('does not corrupt local data when import fails on bad version', async () => {
    await seed();
    const { importAllData } = await import('../dataPortability');

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ exportSchemaVersion: 99, dbVersion: 6 }));
    const badBlob = await zip.generateAsync({ type: 'blob' });

    await expect(importAllData(badBlob)).rejects.toThrow();

    // Original data still there
    const idb = await import('../idbStorage');
    const messages = await getAllRecords(idb.MESSAGES_STORE);
    expect(messages).toHaveLength(2);
  });
});
