import {
  getDB,
  APP_KV_STORE,
  APP_KV_BY_APP_INDEX,
} from '@/platform/storage/idbStorage';

/**
 * Shape of every row in the `app-kv` object store. The outer wrapper
 * structure lets us index by `appId` so uninstall can scan all rows
 * for a given app in one cursor pass.
 */
export interface AppKvRecord {
  appId: string;
  scope: 'app' | 'global' | 'owner';
  /** Owner id when scope === 'owner'; empty string otherwise. */
  ownerId: string;
  /** The key the user code passed to set() / globalSet(). */
  userKey: string;
  value: unknown;
}

export async function appStorageGet(
  appId: string,
  fullKey: string,
): Promise<AppKvRecord | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readonly');
    const req = tx.objectStore(APP_KV_STORE).get(fullKey);
    req.onsuccess = () => {
      const record = req.result as AppKvRecord | undefined;
      if (record && record.appId !== appId) {
        // Defensive: key collision across apps is prevented by design,
        // but if it ever happens, treat as miss.
        resolve(undefined);
      } else {
        resolve(record);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function appStorageSet(
  appId: string,
  fullKey: string,
  record: AppKvRecord,
): Promise<void> {
  if (record.appId !== appId) {
    throw new Error(
      `appStorageSet: record.appId "${record.appId}" mismatches arg appId "${appId}"`,
    );
  }
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    tx.objectStore(APP_KV_STORE).put(record, fullKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function appStorageRemove(
  appId: string,
  fullKey: string,
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    tx.objectStore(APP_KV_STORE).delete(fullKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    void appId; // reserved for future audit logging
  });
}

export async function appStorageListByAppId(appId: string): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readonly');
    const store = tx.objectStore(APP_KV_STORE);
    const index = store.index(APP_KV_BY_APP_INDEX);
    const cursorReq = index.openKeyCursor(IDBKeyRange.only(appId));
    const keys: string[] = [];
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        keys.push(String(cursor.primaryKey));
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(keys);
    tx.onerror = () => reject(tx.error);
  });
}

export async function appStorageDeleteAllByAppId(appId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    const store = tx.objectStore(APP_KV_STORE);
    const index = store.index(APP_KV_BY_APP_INDEX);
    const cursorReq = index.openCursor(IDBKeyRange.only(appId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
