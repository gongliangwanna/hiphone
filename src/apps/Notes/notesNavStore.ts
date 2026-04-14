import { create } from 'zustand';

interface NotesNavState {
  stack: string[];
  activeNoteId: string | null;
  shareSheetOpen: boolean;
  push: (page: string, noteId?: string | null) => void;
  pop: () => void;
  reset: () => void;
  setActiveNoteId: (id: string | null) => void;
  openShareSheet: () => void;
  closeShareSheet: () => void;
}

export const useNotesNavStore = create<NotesNavState>()((set) => ({
  stack: ['list'],
  activeNoteId: null,
  shareSheetOpen: false,

  push: (page, noteId) =>
    set((state) => ({
      stack: [...state.stack, page],
      activeNoteId: noteId ?? null,
    })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
      activeNoteId: null,
      shareSheetOpen: false,
    })),

  reset: () =>
    set({ stack: ['list'], activeNoteId: null, shareSheetOpen: false }),

  setActiveNoteId: (id) =>
    set({ activeNoteId: id }),

  openShareSheet: () =>
    set({ shareSheetOpen: true }),

  closeShareSheet: () =>
    set({ shareSheetOpen: false }),
}));
