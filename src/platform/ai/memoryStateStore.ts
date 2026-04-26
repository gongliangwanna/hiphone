/**
 * Per-character memory state — structured storage for fact chains,
 * relationship model, open loops, highlights, episodic summary.
 *
 * Companion to characterMemoryStore (raw entry stream). Compression
 * pipeline reads entries + state, writes patches back to state via
 * memoryStateMutations. promptAssembly reads state for system-tail
 * rendering.
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

import { create } from 'zustand';
import {
  putMemoryState,
  loadAllMemoryStates,
  deleteMemoryState,
} from '@/platform/storage/idbRecordStorage';
import {
  type CharacterMemoryStateRecord,
  makeInitialState,
} from './memoryStateTypes';

interface MemoryStateStore {
  states: Record<string, CharacterMemoryStateRecord>;
  get: (characterId: string) => CharacterMemoryStateRecord | undefined;
  getOrInit: (characterId: string, addressToUser?: string) => CharacterMemoryStateRecord;
  set: (characterId: string, state: CharacterMemoryStateRecord) => void;
  remove: (characterId: string) => void;
  clearAll: () => void;
}

export const useMemoryState = create<MemoryStateStore>((set, get) => ({
  states: {},

  get(characterId) {
    return get().states[characterId];
  },

  getOrInit(characterId, addressToUser) {
    const existing = get().states[characterId];
    if (existing) return existing;
    const fresh = makeInitialState(characterId, addressToUser);
    set((s) => ({ states: { ...s.states, [characterId]: fresh } }));
    return fresh;
  },

  set(characterId, state) {
    set((s) => ({ states: { ...s.states, [characterId]: state } }));
  },

  remove(characterId) {
    set((s) => {
      const next = { ...s.states };
      delete next[characterId];
      return { states: next };
    });
  },

  clearAll() {
    set({ states: {} });
  },
}));

// ════════════════════════════════════════════════════════════════════════════
// IDB sync
// ════════════════════════════════════════════════════════════════════════════

let unsubscribe: (() => void) | null = null;

export async function loadMemoryStateFromIdb(): Promise<void> {
  const records = await loadAllMemoryStates();
  const grouped: Record<string, CharacterMemoryStateRecord> = {};
  for (const r of records) grouped[r.characterId] = r;
  useMemoryState.setState({ states: grouped });
}

export function startMemoryStateIdbSync(): void {
  if (unsubscribe) return;
  let prev = useMemoryState.getState().states;
  unsubscribe = useMemoryState.subscribe((s) => {
    const next = s.states;
    const allIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const id of allIds) {
      const p = prev[id];
      const n = next[id];
      if (n && n !== p) void putMemoryState(n);
      else if (!n && p) void deleteMemoryState(id);
    }
    prev = next;
  });
}

export function stopMemoryStateIdbSync(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function _resetMemoryStateForTests(): Promise<void> {
  stopMemoryStateIdbSync();
  const ids = Object.keys(useMemoryState.getState().states);
  useMemoryState.setState({ states: {} });
  for (const id of ids) await deleteMemoryState(id);
}
