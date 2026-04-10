import { create } from 'zustand';

interface CalendarNavState {
  stack: string[];
  activeEventId: string | null;
  editingEventId: string | null;

  push: (page: string, opts?: { eventId?: string; editing?: boolean }) => void;
  pop: () => void;
  reset: () => void;
}

export const useCalendarNavStore = create<CalendarNavState>()((set) => ({
  stack: ['month'],
  activeEventId: null,
  editingEventId: null,

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
    })),

  reset: () =>
    set({ stack: ['month'], activeEventId: null, editingEventId: null }),
}));
