/**
 * Full backup / restore for hiPhone's IndexedDB.
 *
 * Export packs every object store into a single ZIP:
 *   manifest.json + kv/<key>.json (one per persist key) + <store>.json (record stores)
 *
 * Import validates the manifest, downloads a safety backup of current state,
 * then replaces every object store. Caller is responsible for reloading the
 * page after a successful import (so Zustand stores rehydrate from disk).
 */
import JSZip from 'jszip';
import {
  getDB,
  MESSAGES_STORE,
  MOMENTS_STORE,
  MEMORY_STORE,
  MEMORY_STATE_STORE,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from './idbStorage';
import * as downloadBlobModule from './downloadBlob';

const KV_STORE = 'kv';

/** Stores with inline keyPath — exported as plain arrays, imported with put(record). */
const INLINE_KEY_STORES = [
  MESSAGES_STORE,
  MOMENTS_STORE,
  MEMORY_STORE,
  MEMORY_STATE_STORE,
] as const;

/** Stores with out-of-line keys — exported as [{key, value}] pairs, imported with put(value, key). */
const OUT_OF_LINE_STORES = [
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
] as const;

const ALL_RECORD_STORES = [...INLINE_KEY_STORES, ...OUT_OF_LINE_STORES] as const;

export const EXPORT_SCHEMA_VERSION = 1;
export const SUPPORTED_DB_VERSION = 6;

interface KvEntry {
  key: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------

function getAllKvEntries(db: IDBDatabase): Promise<KvEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, 'readonly');
    const store = tx.objectStore(KV_STORE);
    const entries: KvEntry[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push({ key: cursor.key as string, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPairsFromStore(db: IDBDatabase, storeName: string): Promise<KvEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const entries: KvEntry[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push({ key: cursor.key as string, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

function replaceKv(db: IDBDatabase, entries: ReadonlyArray<[string, unknown]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, 'readwrite');
    const store = tx.objectStore(KV_STORE);
    store.clear();
    for (const [key, value] of entries) {
      store.put(value, key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function replaceInlineKeyStore(
  db: IDBDatabase,
  storeName: string,
  records: ReadonlyArray<unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function replaceOutOfLineStore(
  db: IDBDatabase,
  storeName: string,
  pairs: ReadonlyArray<KvEntry>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const { key, value } of pairs) {
      store.put(value, key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportAllData(): Promise<Blob> {
  const db = await getDB();
  const zip = new JSZip();

  const kvEntries = await getAllKvEntries(db);
  const kvFolder = zip.folder('kv');
  if (!kvFolder) throw new Error('failed to create kv folder in zip');
  for (const { key, value } of kvEntries) {
    kvFolder.file(`${encodeURIComponent(key)}.json`, JSON.stringify(value));
  }

  const counts: Record<string, { keyCount?: number; recordCount?: number }> = {
    kv: { keyCount: kvEntries.length },
  };
  // Older DBs may be missing newer stores (the upgrade handler is guarded but
  // historical bugs left some stores absent). Skip what isn't there rather
  // than crash — the manifest still records 0, so import is a no-op.
  for (const storeName of INLINE_KEY_STORES) {
    const records = db.objectStoreNames.contains(storeName)
      ? await getAllFromStore(db, storeName)
      : [];
    counts[storeName] = { recordCount: records.length };
    zip.file(`${storeName}.json`, JSON.stringify(records));
  }
  for (const storeName of OUT_OF_LINE_STORES) {
    const pairs = db.objectStoreNames.contains(storeName)
      ? await getAllPairsFromStore(db, storeName)
      : [];
    counts[storeName] = { recordCount: pairs.length };
    zip.file(`${storeName}.json`, JSON.stringify(pairs));
  }

  const manifest = {
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    dbVersion: SUPPORTED_DB_VERSION,
    exportedAt: new Date().toISOString(),
    objectStores: counts,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function timestampForFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
}

export function backupFilename(prefix = 'hiphone-backup', date = new Date()): string {
  return `${prefix}-${timestampForFilename(date)}.zip`;
}

export async function importAllData(zipBlob: Blob): Promise<void> {
  const zip = await JSZip.loadAsync(zipBlob);

  const manifestText = await zip.file('manifest.json')?.async('string');
  if (!manifestText) {
    throw new Error('备份文件无效：缺少 manifest.json');
  }
  let manifest: { exportSchemaVersion?: number; dbVersion?: number };
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error('备份文件无效：manifest.json 解析失败');
  }
  if (manifest.exportSchemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `不支持的备份格式版本 v${manifest.exportSchemaVersion}（当前支持 v${EXPORT_SCHEMA_VERSION}）`,
    );
  }
  if (manifest.dbVersion !== SUPPORTED_DB_VERSION) {
    throw new Error(
      `备份来自不兼容的数据库版本（v${manifest.dbVersion}，当前 v${SUPPORTED_DB_VERSION}）`,
    );
  }

  // Pre-parse all incoming data BEFORE clearing anything, so a malformed
  // payload does not leave us with a half-wiped database.
  const kvEntries: Array<[string, unknown]> = [];
  const kvFolder = zip.folder('kv');
  if (kvFolder) {
    const tasks: Array<Promise<void>> = [];
    kvFolder.forEach((relativePath, file) => {
      if (file.dir) return;
      tasks.push(
        file.async('string').then((text) => {
          const key = decodeURIComponent(relativePath.replace(/\.json$/, ''));
          kvEntries.push([key, JSON.parse(text)]);
        }),
      );
    });
    await Promise.all(tasks);
  }

  const inlineData: Record<string, unknown[]> = {};
  for (const storeName of INLINE_KEY_STORES) {
    const text = await zip.file(`${storeName}.json`)?.async('string');
    inlineData[storeName] = text ? (JSON.parse(text) as unknown[]) : [];
  }
  const outOfLineData: Record<string, KvEntry[]> = {};
  for (const storeName of OUT_OF_LINE_STORES) {
    const text = await zip.file(`${storeName}.json`)?.async('string');
    outOfLineData[storeName] = text ? (JSON.parse(text) as KvEntry[]) : [];
  }

  // Safety backup of CURRENT data before we overwrite anything.
  const safetyBackup = await exportAllData();
  downloadBlobModule.downloadBlob(safetyBackup, backupFilename('hiphone-pre-import-backup'));

  const db = await getDB();
  await replaceKv(db, kvEntries);
  for (const storeName of INLINE_KEY_STORES) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    await replaceInlineKeyStore(db, storeName, inlineData[storeName] ?? []);
  }
  for (const storeName of OUT_OF_LINE_STORES) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    await replaceOutOfLineStore(db, storeName, outOfLineData[storeName] ?? []);
  }
}

// Re-export for tests and consumers that want to know the canonical store list.
export const ALL_OBJECT_STORES = [KV_STORE, ...ALL_RECORD_STORES] as const;
