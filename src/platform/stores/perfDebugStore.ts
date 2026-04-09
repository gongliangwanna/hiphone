import { create } from 'zustand';
import { defaultPerfDebugPrefs, type PerfDebugPrefs } from '@/platform/perf/diagnostics';

interface PerfDebugState extends PerfDebugPrefs {
  hydrate: (prefs: PerfDebugPrefs) => void;
  setEnabled: (enabled: boolean) => void;
  setDisableWallpaper: (value: boolean) => void;
  setDisableDesktopFilter: (value: boolean) => void;
  setReduceTransparency: (value: boolean) => void;
  setHideIconImages: (value: boolean) => void;
}

export const usePerfDebugStore = create<PerfDebugState>()((set) => ({
  ...defaultPerfDebugPrefs,
  hydrate: (prefs) => set({ ...prefs }),
  setEnabled: (enabled) => set({ enabled }),
  setDisableWallpaper: (disableWallpaper) => set({ disableWallpaper }),
  setDisableDesktopFilter: (disableDesktopFilter) => set({ disableDesktopFilter }),
  setReduceTransparency: (reduceTransparency) => set({ reduceTransparency }),
  setHideIconImages: (hideIconImages) => set({ hideIconImages }),
}));
