import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { EntityStoreRegistry } from '@/platform/storage/entityStoreRegistry';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { uid } from '@/platform/utils/uid';
import { stripHtml } from './richTextUtils';

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotesDataState {
  notes: Note[];
  searchQuery: string;

  addNote: (title: string, body: string) => string;
  updateNote: (id: string, title: string, body: string) => void;
  deleteNote: (id: string) => void;
  setSearchQuery: (query: string) => void;
}

const SEED_NOTE: Note = {
  id: 'welcome',
  title: '欢迎使用备忘录',
  body: '这是你的第一条备忘录。你可以在这里记录任何内容。',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// Store factory — used by EntityStoreRegistry to create per-entity instances
// ---------------------------------------------------------------------------

function createNotesStore(persistName: string) {
  const isPlayerStore = persistName === 'hiPhone-notes';

  return create<NotesDataState>()(
    persist(
      (set) => ({
        // AI stores start empty; player store gets seed note (IDB rehydration
        // will overwrite this for existing players)
        notes: isPlayerStore ? [SEED_NOTE] : [],
        searchQuery: '',

        addNote: (title, body) => {
          const id = uid();
          const now = Date.now();
          set((state) => ({
            notes: [
              { id, title, body, createdAt: now, updatedAt: now },
              ...state.notes,
            ],
          }));
          return id;
        },

        updateNote: (id, title, body) => {
          set((state) => ({
            notes: state.notes.map((n) =>
              n.id === id ? { ...n, title, body, updatedAt: Date.now() } : n,
            ),
          }));
        },

        deleteNote: (id) => {
          set((state) => ({
            notes: state.notes.filter((n) => n.id !== id),
          }));
        },

        setSearchQuery: (query) => {
          set({ searchQuery: query });
        },
      }),
      {
        name: persistName,
        storage: idbStorage,
        partialize: (state) => ({ notes: state.notes }),
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Registry + backward-compatible exports
// ---------------------------------------------------------------------------

export const notesRegistry = new EntityStoreRegistry(createNotesStore, 'hiPhone-notes');

/** Player's notes store — backward compatible (same IDB key). */
export const useNotesDataStore = notesRegistry.getStore(null);

/**
 * Perspective-aware notes store hook.
 * Returns data from the current phone owner's notes store.
 */
export function useActiveNotesStore<T>(selector: (s: NotesDataState) => T): T {
  const phoneOwnerId = usePhoneOwnerStore((s) => s.phoneOwnerId);
  const store = notesRegistry.getStore(phoneOwnerId);
  return store(selector);
}

/** Selector: filtered + sorted notes */
export function selectFilteredNotes(state: NotesDataState): Note[] {
  const q = state.searchQuery.toLowerCase().trim();
  let result = state.notes;
  if (q) {
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        stripHtml(n.body).toLowerCase().includes(q),
    );
  }
  return [...result].sort((a, b) => b.updatedAt - a.updatedAt);
}
