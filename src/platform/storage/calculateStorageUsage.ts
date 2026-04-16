// src/platform/storage/calculateStorageUsage.ts
import { getDB, hasIDB, MESSAGES_STORE, MOMENTS_STORE } from './idbStorage';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

export interface StorageCategoryDef {
  key: string;
  label: string;
  color: string;
  icon: string; // lucide-react icon name
}

export const STORAGE_CATEGORIES: StorageCategoryDef[] = [
  { key: 'messages', label: '聊天消息', color: '#34C759', icon: 'MessageCircle' },
  { key: 'moments', label: '朋友圈动态', color: '#5856D6', icon: 'Image' },
  { key: 'characters', label: '角色卡', color: '#AF52DE', icon: 'User' },
  { key: 'notes', label: '备忘录', color: '#FF9500', icon: 'Pencil' },
  { key: 'calendar', label: '日历事件', color: '#007AFF', icon: 'Calendar' },
  { key: 'other', label: '其他', color: '#8E8E93', icon: 'Folder' },
];

// ---------------------------------------------------------------------------
// KV key → category mapping
// ---------------------------------------------------------------------------

const CHARACTER_KEYS = new Set([
  'hiPhone-characters',
  'hiPhone-persona',
  'hiPhone-world-books',
]);

export function classifyKvKey(key: string): string {
  if (CHARACTER_KEYS.has(key)) return 'characters';
  if (key === 'hiPhone-notes' || key.startsWith('hiPhone-notes::')) return 'notes';
  if (key === 'hiPhone-calendar') return 'calendar';
  return 'other';
}

// ---------------------------------------------------------------------------
// Byte estimation
// ---------------------------------------------------------------------------

function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Format bytes for display
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return '< 1 KB';
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export interface StorageUsageResult {
  /** Bytes per category key */
  byCategory: Record<string, number>;
  totalBytes: number;
}

export async function calculateStorageUsage(): Promise<StorageUsageResult> {
  const byCategory: Record<string, number> = {};
  for (const cat of STORAGE_CATEGORIES) {
    byCategory[cat.key] = 0;
  }

  if (!hasIDB) return { byCategory, totalBytes: 0 };

  try {
    const db = await getDB();

    // 1. Messages store → 'messages' category
    const messages = await getAllFromStore(db, MESSAGES_STORE);
    for (const msg of messages) {
      byCategory.messages += estimateBytes(msg);
    }

    // 2. Moments store → 'moments' category
    const moments = await getAllFromStore(db, MOMENTS_STORE);
    for (const m of moments) {
      byCategory.moments += estimateBytes(m);
    }

    // 3. KV store → classify by key
    const kvEntries = await getAllKvEntries(db);
    for (const { key, value } of kvEntries) {
      const category = classifyKvKey(key);
      byCategory[category] = (byCategory[category] ?? 0) + estimateBytes(value);
    }
  } catch (e) {
    console.warn('[calculateStorageUsage] failed:', e);
  }

  const totalBytes = Object.values(byCategory).reduce((sum, b) => sum + b, 0);
  return { byCategory, totalBytes };
}

// ---------------------------------------------------------------------------
// IDB helpers (read-only traversal)
// ---------------------------------------------------------------------------

function getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllKvEntries(
  db: IDBDatabase,
): Promise<{ key: string; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const store = tx.objectStore('kv');
    const entries: { key: string; value: unknown }[] = [];
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
