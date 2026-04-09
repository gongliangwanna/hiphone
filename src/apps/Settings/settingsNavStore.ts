import { create } from 'zustand';

interface NavState {
  stack: string[];
  push: (page: string) => void;
  pop: () => void;
  reset: () => void;
}

export const useSettingsNavStore = create<NavState>()((set) => ({
  stack: ['home'],

  push: (page) =>
    set((state) => ({ stack: [...state.stack, page] })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
    })),

  reset: () =>
    set({ stack: ['home'] }),
}));
