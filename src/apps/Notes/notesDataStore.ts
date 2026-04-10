import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface NotesDataState {
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

export const useNotesDataStore = create<NotesDataState>()(
  persist(
    (set) => ({
      notes: [SEED_NOTE],
      searchQuery: '',

      addNote: (title, body) => {
        const id = crypto.randomUUID();
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
      name: 'hiPhone-notes',
      partialize: (state) => ({ notes: state.notes }),
    },
  ),
);

/** Selector: filtered + sorted notes */
export function selectFilteredNotes(state: NotesDataState): Note[] {
  const q = state.searchQuery.toLowerCase().trim();
  let result = state.notes;
  if (q) {
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q),
    );
  }
  return [...result].sort((a, b) => b.updatedAt - a.updatedAt);
}
