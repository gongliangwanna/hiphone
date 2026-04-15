import { create } from 'zustand';

interface CalendarNavState {
  stack: string[];
  activeEventId: string | null;
  editingEventId: string | null;
  /** CalendarApp sets true → EventForm consumes and calls handleSave */
  pendingSave: boolean;
  /** EventForm updates → CalendarApp reads for NavBar button disabled state */
  formValid: boolean;

  push: (page: string, opts?: { eventId?: string; editing?: boolean }) => void;
  pop: () => void;
  reset: () => void;
  setPendingSave: (v: boolean) => void;
  setFormValid: (v: boolean) => void;
}

export const useCalendarNavStore = create<CalendarNavState>()((set) => ({
  stack: ['month'],
  activeEventId: null,
  editingEventId: null,
  pendingSave: false,
  formValid: false,

  push: (page, opts) =>
    set((state) => ({
      stack: [...state.stack, page],
      activeEventId: opts?.eventId ?? null,
      editingEventId: opts?.editing ? (opts.eventId ?? null) : null,
    })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
      activeEventId: null,
      editingEventId: null,
      pendingSave: false,
      formValid: false,
    })),

  reset: () =>
    set({
      stack: ['month'],
      activeEventId: null,
      editingEventId: null,
      pendingSave: false,
      formValid: false,
    }),

  setPendingSave: (v) => set({ pendingSave: v }),
  setFormValid: (v) => set({ formValid: v }),
}));
