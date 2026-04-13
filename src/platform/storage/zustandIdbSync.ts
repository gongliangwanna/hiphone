/**
 * Subscribe-based write-through sync for xingYuDataStore → IndexedDB.
 *
 * Instead of serializing the entire state on every setState(), this module
 * subscribes to Zustand state changes, diffs messages/moments arrays by
 * reference, and writes only changed records to IDB.
 *
 * Call startXYDataSync() after hydration completes.
 */

import { hasIDB } from './idbStorage';
import {
  putMessages,
  deleteMessages,
  putMoments,
  deleteMoments,
} from './idbRecordStorage';
import type { Message, Moment } from '@/apps/XingYu/data';

// ---------------------------------------------------------------------------
// Diff helper
// ---------------------------------------------------------------------------

interface DiffResult<T extends { id: string }> {
  added: T[];
  updated: T[];
  removed: T[];
}

/**
 * O(n) diff between prev and next arrays using id + reference equality.
 * - added: in next but not in prev
 * - updated: same id, different reference (e.g. moment got liked)
 * - removed: in prev but not in next
 */
function diffById<T extends { id: string }>(prev: T[], next: T[]): DiffResult<T> {
  const prevMap = new Map<string, T>();
  for (const item of prev) prevMap.set(item.id, item);

  const added: T[] = [];
  const updated: T[] = [];
  const seenIds = new Set<string>();

  for (const item of next) {
    seenIds.add(item.id);
    const old = prevMap.get(item.id);
    if (!old) {
      added.push(item);
    } else if (old !== item) {
      updated.push(item);
    }
  }

  const removed: T[] = [];
  for (const [id, item] of prevMap) {
    if (!seenIds.has(id)) removed.push(item);
  }

  return { added, updated, removed };
}

// ---------------------------------------------------------------------------
// Sync subscription
// ---------------------------------------------------------------------------

let unsubscribe: (() => void) | null = null;

/**
 * Start syncing xingYuDataStore messages/moments to IndexedDB per-record stores.
 * Must be called after hydration so the initial snapshot is correct.
 */
export function startXYDataSync(store: {
  getState: () => { messages: Message[]; moments: Moment[] };
  subscribe: (listener: (state: { messages: Message[]; moments: Moment[] }) => void) => () => void;
}) {
  if (!hasIDB) return;
  if (unsubscribe) return; // already running

  let prevMsgs = store.getState().messages;
  let prevMoments = store.getState().moments;

  unsubscribe = store.subscribe((state) => {
    // Messages diff
    if (state.messages !== prevMsgs) {
      const diff = diffById(prevMsgs, state.messages);
      const toPut = [...diff.added, ...diff.updated];
      if (toPut.length > 0) putMessages(toPut);
      if (diff.removed.length > 0) deleteMessages(diff.removed.map((m) => m.id));
      prevMsgs = state.messages;
    }

    // Moments diff
    if (state.moments !== prevMoments) {
      const diff = diffById(prevMoments, state.moments);
      const toPut = [...diff.added, ...diff.updated];
      if (toPut.length > 0) putMoments(toPut);
      if (diff.removed.length > 0) deleteMoments(diff.removed.map((m) => m.id));
      prevMoments = state.moments;
    }
  });

  // Flush on page unload to minimize data loss window
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushSync);
  }
}

/**
 * Force a final sync pass. Called on beforeunload.
 * Since per-record IDB writes are fast (~1ms each), the browser's
 * unload grace period is sufficient to complete pending transactions.
 */
function flushSync() {
  // The subscribe callback fires synchronously on setState(),
  // so by the time beforeunload fires, all pending diffs have
  // already been dispatched to IDB. No additional action needed
  // unless we add debouncing in the future.
}

export function stopXYDataSync() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', flushSync);
  }
}
