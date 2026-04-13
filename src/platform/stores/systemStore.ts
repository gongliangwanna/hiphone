import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

export type DarkMode = 'light' | 'dark' | 'auto';

export interface CustomWallpaper {
  id: string;
  src: string;
}

export interface SystemState {
  /** Whether the device is currently locked (showing lock screen) */
  isLocked: boolean;
  /** Screen brightness 0–1 */
  brightness: number;
  /** Volume 0–1 */
  volume: number;
  /** Current wallpaper ID */
  wallpaperId: string;
  /** User-uploaded custom wallpapers (data URLs) */
  customWallpapers: CustomWallpaper[];
  /** Text size multiplier 0.8–1.4 */
  textSize: number;
  /** Dark mode preference */
  darkMode: DarkMode;
  /** Silent mode toggle */
  silentMode: boolean;

  lock: () => void;
  unlock: () => void;
  setBrightness: (v: number) => void;
  setVolume: (v: number) => void;
  setWallpaper: (id: string) => void;
  addCustomWallpaper: (wallpaper: CustomWallpaper) => void;
  removeCustomWallpaper: (id: string) => void;
  setTextSize: (v: number) => void;
  setDarkMode: (m: DarkMode) => void;
  setSilentMode: (v: boolean) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      isLocked: true,
      brightness: 0.8,
      volume: 0.5,
      wallpaperId: 'ios-26-stock-01',
      customWallpapers: [],
      textSize: 1.0,
      darkMode: 'light',
      silentMode: false,

      lock: () => set({ isLocked: true }),
      unlock: () => set({ isLocked: false }),
      setBrightness: (v) => set({ brightness: Math.max(0, Math.min(1, v)) }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setWallpaper: (id) => set({ wallpaperId: id }),
      addCustomWallpaper: (wallpaper) =>
        set((state) => ({ customWallpapers: [...state.customWallpapers, wallpaper] })),
      removeCustomWallpaper: (id) =>
        set((state) => ({
          customWallpapers: state.customWallpapers.filter((w) => w.id !== id),
          // Reset to default if the removed wallpaper was active
          wallpaperId: state.wallpaperId === id ? 'ios-26-stock-01' : state.wallpaperId,
        })),
      setTextSize: (v) => set({ textSize: Math.max(0.8, Math.min(1.4, v)) }),
      setDarkMode: (m) => set({ darkMode: m }),
      setSilentMode: (v) => set({ silentMode: v }),
    }),
    {
      name: 'hiPhone-system',
      storage: idbStorage,
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        customWallpapers: state.customWallpapers,
        brightness: state.brightness,
        volume: state.volume,
        textSize: state.textSize,
        darkMode: state.darkMode,
        silentMode: state.silentMode,
      }),
    },
  ),
);
