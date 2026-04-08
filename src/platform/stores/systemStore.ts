import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SystemState {
  /** Whether the device is currently locked (showing lock screen) */
  isLocked: boolean;
  /** Screen brightness 0–1 */
  brightness: number;
  /** Volume 0–1 */
  volume: number;
  /** Current wallpaper ID */
  wallpaperId: string;

  lock: () => void;
  unlock: () => void;
  setBrightness: (v: number) => void;
  setVolume: (v: number) => void;
  setWallpaper: (id: string) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      isLocked: true,
      brightness: 0.8,
      volume: 0.5,
      wallpaperId: 'ios-26-stock-01',

      lock: () => set({ isLocked: true }),
      unlock: () => set({ isLocked: false }),
      setBrightness: (v) => set({ brightness: Math.max(0, Math.min(1, v)) }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setWallpaper: (id) => set({ wallpaperId: id }),
    }),
    {
      name: 'hiPhone-system',
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        brightness: state.brightness,
        volume: state.volume,
      }),
    },
  ),
);
