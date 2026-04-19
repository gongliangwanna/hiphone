/**
 * Platform-level AI memory layer — per-character conversation stream.
 *
 * Designed to be the single source of truth for "what this character
 * remembers", independent of any specific UI / app. XingYu, user apps
 * via @hiphone/ai, heartbeat agent, and aiChatEngine all funnel writes
 * through this store; promptAssembly reads from it exclusively.
 *
 * Content is stored raw — for XingYu-style assistant replies that
 * means the original JSON string, preserving stickerId, signature
 * actions, and any other structured information the model emitted.
 * The speakerId field disambiguates multi-party context (group chat,
 * AI-AI observation) so render can prefix each user-role turn with the
 * correct display name.
 *
 * See docs/superpowers/specs/2026-04-19-m4.1-ai-sdk-xingyu-migration-design.md §1
 */

import { create } from 'zustand';
import { uid } from '@/platform/utils/uid';

export type MemoryRole = 'user' | 'assistant' | 'system';

export type MemorySource =
  | 'xingyu'
  | `app:${string}`
  | 'heartbeat'
  | 'system';

export interface MemoryEntry {
  id: string;
  characterId: string;
  role: MemoryRole;
  speakerId: string;
  content: string;
  source: MemorySource;
  createdAt: number;
  compressed?: true;
}

type AppendInput = Omit<MemoryEntry, 'id' | 'characterId' | 'createdAt'>;

export interface CharacterMemoryState {
  entries: Record<string, MemoryEntry[]>;
  append: (characterId: string, entry: AppendInput) => MemoryEntry;
  batchAppend: (characterId: string, entries: AppendInput[]) => MemoryEntry[];
  getAll: (characterId: string) => readonly MemoryEntry[];
  getSnapshot: (characterId: string) => readonly MemoryEntry[];
  replaceRange: (
    characterId: string,
    startId: string,
    endId: string,
    summary: MemoryEntry,
  ) => void;
  clear: (characterId: string) => void;
  /** Test-only / memory-viewer-only: wipe the whole store. */
  clearAll: () => void;
}

function makeEntry(characterId: string, input: AppendInput): MemoryEntry {
  return {
    id: uid(),
    characterId,
    createdAt: Date.now(),
    ...input,
  };
}

export const useCharacterMemory = create<CharacterMemoryState>((set, get) => ({
  entries: {},

  append(characterId, input) {
    const entry = makeEntry(characterId, input);
    set((state) => ({
      entries: {
        ...state.entries,
        [characterId]: [...(state.entries[characterId] ?? []), entry],
      },
    }));
    return entry;
  },

  batchAppend(characterId, inputs) {
    const newEntries = inputs.map((i) => makeEntry(characterId, i));
    set((state) => ({
      entries: {
        ...state.entries,
        [characterId]: [...(state.entries[characterId] ?? []), ...newEntries],
      },
    }));
    return newEntries;
  },

  getAll(characterId) {
    return get().entries[characterId] ?? [];
  },

  getSnapshot(characterId) {
    return Object.freeze([...(get().entries[characterId] ?? [])]);
  },

  replaceRange(characterId, startId, endId, summary) {
    set((state) => {
      const list = state.entries[characterId] ?? [];
      const startIdx = list.findIndex((e) => e.id === startId);
      const endIdx = list.findIndex((e) => e.id === endId);
      if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return state;
      const next = [
        ...list.slice(0, startIdx),
        summary,
        ...list.slice(endIdx + 1),
      ];
      return { entries: { ...state.entries, [characterId]: next } };
    });
  },

  clear(characterId) {
    set((state) => {
      const next = { ...state.entries };
      delete next[characterId];
      return { entries: next };
    });
  },

  clearAll() {
    set({ entries: {} });
  },
}));

// ════════════════════════════════════════════════════════════════════════════
// IDB persistence
// ════════════════════════════════════════════════════════════════════════════
//
// Storage: object store MEMORY_STORE, keyed by MemoryEntry.id. Each record is
// the full entry (including characterId). On rehydrate we group by characterId
// and sort by createdAt. Writes are driven by a Zustand subscription that
// diffs prev vs next state and issues put/delete per change.

import {
  putMemoryEntries,
  deleteMemoryEntries,
  loadAllMemoryEntries,
  clearAllMemoryEntries,
} from '@/platform/storage/idbRecordStorage';

let unsubscribe: (() => void) | null = null;

export async function loadCharacterMemoryFromIdb(): Promise<void> {
  const records = await loadAllMemoryEntries();
  const grouped: Record<string, MemoryEntry[]> = {};
  for (const r of records) {
    (grouped[r.characterId] ??= []).push(r);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }
  useCharacterMemory.setState({ entries: grouped });
}

/**
 * Begin mirroring every append / replaceRange / clear to IDB. Idempotent.
 * Diffs prev vs next entries per character; puts new, deletes removed.
 */
export function startCharacterMemoryIdbSync(): void {
  if (unsubscribe) return;
  let prev: Record<string, MemoryEntry[]> = useCharacterMemory.getState().entries;
  unsubscribe = useCharacterMemory.subscribe((state) => {
    const next = state.entries;
    const allCharIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const charId of allCharIds) {
      const prevList = prev[charId] ?? [];
      const nextList = next[charId] ?? [];
      const prevIds = new Set(prevList.map((e) => e.id));
      const nextIds = new Set(nextList.map((e) => e.id));

      const added: MemoryEntry[] = [];
      for (const e of nextList) if (!prevIds.has(e.id)) added.push(e);
      if (added.length) void putMemoryEntries(added);

      const removed: string[] = [];
      for (const e of prevList) if (!nextIds.has(e.id)) removed.push(e.id);
      if (removed.length) void deleteMemoryEntries(removed);
    }
    prev = next;
  });
}

export function stopCharacterMemoryIdbSync(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

/** Test-only: wipe IDB + in-memory state. */
export async function _resetCharacterMemoryForTests(): Promise<void> {
  stopCharacterMemoryIdbSync();
  useCharacterMemory.setState({ entries: {} });
  await clearAllMemoryEntries();
}
