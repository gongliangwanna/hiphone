/**
 * IndexedDB storage adapter for Zustand persist.
 *
 * Replaces localStorage (5 MB cap) with IndexedDB (virtually unlimited).
 * On first access, transparently migrates existing localStorage data so
 * users don't lose anything on upgrade.
 *
 * Usage:
 *   persist(fn, { storage: idbStorage, ... })
 */

// ---------------------------------------------------------------------------
// DB constants
// ---------------------------------------------------------------------------

const DB_NAME = 'hiPhone-storage';
const DB_VERSION = 6;
const STORE_NAME = 'kv';

// Per-record object stores (added in v2)
export const MESSAGES_STORE = 'messages';
export const MOMENTS_STORE = 'moments';

// User-app storage (added in v3)
export const APP_META_STORE = 'app-meta';
export const APP_SRC_STORE = 'app-src';
export const APP_KV_STORE = 'app-kv';
export const APP_KV_BY_APP_INDEX = 'by-app-id';

// AI character memory (added in v4)
export const MEMORY_STORE = 'characterMemory';
export const MEMORY_BY_CHAR_INDEX = 'by-characterId';

// AI character memory state (added in v6)
export const MEMORY_STATE_STORE = 'characterMemoryState';

// ---------------------------------------------------------------------------
// Cached connection — one IDBDatabase instance shared across all stores
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1: KV store for Zustand persist blobs
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // v2: Per-record stores for high-frequency data
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        msgStore.createIndex('convId', 'convId', { unique: false });
      }
      if (!db.objectStoreNames.contains(MOMENTS_STORE)) {
        db.createObjectStore(MOMENTS_STORE, { keyPath: 'id' });
      }
      // v3: User app storage
      if (!db.objectStoreNames.contains(APP_META_STORE)) {
        db.createObjectStore(APP_META_STORE); // key = appId
      }
      if (!db.objectStoreNames.contains(APP_SRC_STORE)) {
        db.createObjectStore(APP_SRC_STORE); // key = appId
      }
      if (!db.objectStoreNames.contains(APP_KV_STORE)) {
        const kvStore = db.createObjectStore(APP_KV_STORE); // key = full key string
        kvStore.createIndex(APP_KV_BY_APP_INDEX, 'appId', { unique: false });
      }
      // v4: AI character memory (MemoryEntry keyed by id, indexed by characterId).
      // v5 re-runs this guarded upgrade to repair any v4 DBs whose
      // upgrade-needed handler skipped MEMORY_STORE creation.
      if (!db.objectStoreNames.contains(MEMORY_STORE)) {
        const memStore = db.createObjectStore(MEMORY_STORE, { keyPath: 'id' });
        memStore.createIndex(MEMORY_BY_CHAR_INDEX, 'characterId', { unique: false });
      }
      // v6: AI character memory STATE (per-character, keyed by characterId).
      if (!db.objectStoreNames.contains(MEMORY_STATE_STORE)) {
        db.createObjectStore(MEMORY_STATE_STORE, { keyPath: 'characterId' });
      }
    };
    req.onsuccess = () => {
      // Close connection when another tab upgrades the DB version
      req.result.onversionchange = () => {
        req.result.close();
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      dbPromise = null; // allow retry
      reject(req.error);
    };
  });
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Low-level IDB helpers
// ---------------------------------------------------------------------------

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Fallback: localStorage adapter (for test environments without IndexedDB)
// ---------------------------------------------------------------------------

export const hasIDB = typeof indexedDB !== 'undefined';

const localStorageFallback = {
  getItem: (name: string) => {
    const raw = localStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: (name: string, value: unknown) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

// ---------------------------------------------------------------------------
// Zustand PersistStorage adapter
// ---------------------------------------------------------------------------

/**
 * Zustand persist storage backed by IndexedDB.
 *
 * Falls back to localStorage when IndexedDB is unavailable (jsdom / SSR).
 *
 * `getItem` transparently migrates from localStorage on first read:
 *   1. Try IndexedDB → return if found
 *   2. Try localStorage → if found, copy to IndexedDB, delete from localStorage
 *   3. Return null
 */
export const idbStorage = hasIDB
  ? {
      getItem: async (name: string) => {
        try {
          const db = await getDB();

          // 1. IndexedDB
          const value = await idbGet(db, name);
          if (value !== undefined && value !== null) return value;

          // 2. Migrate from localStorage
          const raw = localStorage.getItem(name);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              await idbSet(db, name, parsed);
              localStorage.removeItem(name);
              console.log(`[idbStorage] migrated "${name}" from localStorage → IndexedDB`);
              return parsed;
            } catch {
              // Corrupted JSON — discard
              localStorage.removeItem(name);
            }
          }
        } catch (e) {
          console.warn(`[idbStorage] getItem("${name}") failed:`, e);
        }
        return null;
      },

      setItem: async (name: string, value: unknown) => {
        try {
          const db = await getDB();
          await idbSet(db, name, value);
        } catch (e) {
          console.error(`[idbStorage] setItem("${name}") failed:`, e);
        }
      },

      removeItem: async (name: string) => {
        try {
          const db = await getDB();
          await idbDelete(db, name);
        } catch (e) {
          console.warn(`[idbStorage] removeItem("${name}") failed:`, e);
        }
      },
    }
  : localStorageFallback;
