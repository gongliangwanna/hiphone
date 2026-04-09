import { create } from 'zustand';

export interface AssistiveTouchState {
  /** Which horizontal edge the ball is snapped to. */
  anchorEdge: 'left' | 'right';
  /** Vertical position as a fraction of container height (0 = top, 1 = bottom). */
  anchorY: number;
  /** Whether the action menu is currently open. */
  isMenuOpen: boolean;

  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  setAnchor: (edge: 'left' | 'right', y: number) => void;
}

export const useAssistiveTouchStore = create<AssistiveTouchState>()((set) => ({
  anchorEdge: 'right',
  anchorY: 0.7,
  isMenuOpen: false,

  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
  setAnchor: (edge, y) => set({ anchorEdge: edge, anchorY: Math.max(0, Math.min(1, y)) }),
}));
