/**
 * Per-record IndexedDB storage for high-frequency data (messages, moments).
 *
 * Unlike idbStorage (which serializes entire Zustand state as one blob),
 * this module writes individual records to dedicated object stores.
 * Each put/delete is a single small IDB transaction.
 *
 * Shares the same IDBDatabase connection as idbStorage via getDB().
 */

import { getDB, hasIDB, MESSAGES_STORE, MOMENTS_STORE } from './idbStorage';
import type { Message, Moment } from '@/apps/XingYu/data';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function putMessages(msgs: Message[]): Promise<void> {
  if (!hasIDB || msgs.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);
    for (const m of msgs) store.put(m);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] putMessages failed:', e);
  }
}

export async function deleteMessages(ids: string[]): Promise<void> {
  if (!hasIDB || ids.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] deleteMessages failed:', e);
  }
}

export async function deleteMessagesByConvId(convId: string): Promise<void> {
  if (!hasIDB) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);
    const index = store.index('convId');
    const req = index.openCursor(IDBKeyRange.only(convId));
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('[idbRecord] deleteMessagesByConvId failed:', e);
  }
}

export async function loadAllMessages(): Promise<Message[]> {
  if (!hasIDB) return [];
  try {
    const db = await getDB();
    return await new Promise<Message[]>((resolve, reject) => {
      const tx = db.transaction(MESSAGES_STORE, 'readonly');
      const req = tx.objectStore(MESSAGES_STORE).getAll();
      req.onsuccess = () => resolve(req.result as Message[]);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[idbRecord] loadAllMessages failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------

export async function putMoments(moments: Moment[]): Promise<void> {
  if (!hasIDB || moments.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MOMENTS_STORE, 'readwrite');
    const store = tx.objectStore(MOMENTS_STORE);
    for (const m of moments) store.put(m);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] putMoments failed:', e);
  }
}

export async function deleteMoments(ids: string[]): Promise<void> {
  if (!hasIDB || ids.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MOMENTS_STORE, 'readwrite');
    const store = tx.objectStore(MOMENTS_STORE);
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] deleteMoments failed:', e);
  }
}

export async function loadAllMoments(): Promise<Moment[]> {
  if (!hasIDB) return [];
  try {
    const db = await getDB();
    return await new Promise<Moment[]>((resolve, reject) => {
      const tx = db.transaction(MOMENTS_STORE, 'readonly');
      const req = tx.objectStore(MOMENTS_STORE).getAll();
      req.onsuccess = () => resolve(req.result as Moment[]);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[idbRecord] loadAllMoments failed:', e);
    return [];
  }
}
