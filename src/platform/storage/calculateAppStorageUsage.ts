import { canonicalizeAppId } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  APP_KV_BY_APP_INDEX,
  APP_KV_STORE,
  getDB,
  hasIDB,
} from './idbStorage';

export interface AppStorageUsage {
  appId: string;
  appBytes: number;
  dataBytes: number;
  totalBytes: number;
}

function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function getUserAppPackageBytes(appId: string): number {
  const app = useInstalledUserAppsStore
    .getState()
    .apps.find((candidate) => candidate.id === appId);
  return app?.sizeBytes ?? 0;
}

async function getAppKvBytes(appId: string): Promise<number> {
  if (!hasIDB) return 0;

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readonly');
    const store = tx.objectStore(APP_KV_STORE);
    const index = store.index(APP_KV_BY_APP_INDEX);
    const req = index.openCursor(IDBKeyRange.only(appId));
    let bytes = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        bytes += estimateBytes(cursor.value);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(bytes);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function calculateAppStorageUsage(
  appId: string,
): Promise<AppStorageUsage> {
  const canonicalId = canonicalizeAppId(appId);
  const appBytes = getUserAppPackageBytes(canonicalId);
  const dataBytes = await getAppKvBytes(canonicalId);

  return {
    appId: canonicalId,
    appBytes,
    dataBytes,
    totalBytes: appBytes + dataBytes,
  };
}

export async function calculateAllAppStorageUsage(
  appIds: string[],
): Promise<Record<string, AppStorageUsage>> {
  const entries = await Promise.all(
    appIds.map(async (id) => {
      const usage = await calculateAppStorageUsage(id);
      return [usage.appId, usage] as const;
    }),
  );

  return Object.fromEntries(entries);
}
