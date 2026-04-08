import { create } from 'zustand';

export type OverlayType =
  | 'none'
  | 'notifications'
  | 'control-center'
  | 'switcher'
  | 'spotlight';

export interface UIState {
  /** Current active overlay (mutually exclusive) */
  overlay: OverlayType;
  /** Open an overlay (closes any current overlay first) */
  openOverlay: (type: OverlayType) => void;
  /** Close current overlay */
  closeOverlay: () => void;
}

export const useUIStateStore = create<UIState>()((set) => ({
  overlay: 'none',

  openOverlay: (type) => set({ overlay: type }),
  closeOverlay: () => set({ overlay: 'none' }),
}));
