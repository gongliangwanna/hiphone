import { create } from 'zustand';

interface ToastState {
  message: string | null;
  visible: boolean;
  show: (msg: string) => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  visible: false,

  show: (msg) => {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
    }
    set({ message: msg, visible: true });
    dismissTimer = setTimeout(() => {
      set({ visible: false });
      dismissTimer = null;
    }, 2000);
  },
}));
