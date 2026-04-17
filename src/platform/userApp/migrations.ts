import { getDB, APP_KV_STORE } from '@/platform/storage/idbStorage';
import type { AppKvRecord } from './appStorage';

/**
 * One-shot, idempotent migration from S3 flat keys to S4 owner-aware
 * keys. Run during app startup before `loadInstalledApps()`.
 *
 * S3 format:
 *   "{appId}:{userKey}"                → scope='app',    ownerId=''
 *   "{appId}:__global__:{userKey}"     → scope='global', ownerId=''
 *
 * S4 format:
 *   "{appId}:owner:me:{userKey}"       → scope='owner',  ownerId='me'
 *   "{appId}:global:{userKey}"         → scope='global', ownerId=''
 *
 * For each row whose value.scope is 'app' or whose value.scope is
 * 'global' with an `__global__` infix key, rewrite to the S4 key
 * and update the value's scope/ownerId fields. Records already in
 * S4 shape are left untouched (idempotent).
 */
export async function migrateS3ToS4Owner(): Promise<void> {
  const db = await getDB();
  const migrations: Array<{ oldKey: string; newKey: string; newValue: AppKvRecord }> = [];

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readonly');
    const store = tx.objectStore(APP_KV_STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const key = String(cursor.key);
      const record = cursor.value as AppKvRecord;

      if (record.scope === 'app' && record.ownerId === '') {
        // S3 per-app flat → S4 owner:me
        const newKey = `${record.appId}:owner:me:${record.userKey}`;
        const newValue: AppKvRecord = {
          ...record, scope: 'owner', ownerId: 'me',
        };
        migrations.push({ oldKey: key, newKey, newValue });
      } else if (record.scope === 'global' && key.includes(':__global__:')) {
        // S3 global with __global__ infix → S4 global (no __global__)
        const newKey = `${record.appId}:global:${record.userKey}`;
        const newValue: AppKvRecord = { ...record };
        migrations.push({ oldKey: key, newKey, newValue });
      }
      // else: already S4 shape (scope='owner' with ownerId populated, or
      //       scope='global' with non-__global__ key format) — leave alone.

      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (migrations.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    const store = tx.objectStore(APP_KV_STORE);
    for (const m of migrations) {
      store.delete(m.oldKey);
      store.put(m.newValue, m.newKey);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
