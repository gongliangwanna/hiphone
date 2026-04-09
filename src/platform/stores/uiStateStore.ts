import { create } from 'zustand';

export type OverlayType =
  | 'none'
  | 'notifications'
  | 'control-center'
  | 'spotlight';

export interface UIState {
  overlay: OverlayType;
  openOverlay: (type: OverlayType) => void;
  closeOverlay: () => void;
}

export const useUIStateStore = create<UIState>()((set) => ({
  overlay: 'none',

  openOverlay: (type) => set({ overlay: type }),
  closeOverlay: () => set({ overlay: 'none' }),
}));
