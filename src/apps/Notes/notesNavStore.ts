import { create } from 'zustand';

interface NotesNavState {
  stack: string[];
  activeNoteId: string | null;
  push: (page: string, noteId?: string | null) => void;
  pop: () => void;
  reset: () => void;
  setActiveNoteId: (id: string | null) => void;
}

export const useNotesNavStore = create<NotesNavState>()((set) => ({
  stack: ['list'],
  activeNoteId: null,

  push: (page, noteId) =>
    set((state) => ({
      stack: [...state.stack, page],
      activeNoteId: noteId ?? null,
    })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
      activeNoteId: null,
    })),

  reset: () =>
    set({ stack: ['list'], activeNoteId: null }),

  setActiveNoteId: (id) =>
    set({ activeNoteId: id }),
}));
