import { create } from 'zustand';

/**
 * iOS-style banner notification store.
 *
 * One banner visible at a time; incoming banners are queued. Each banner
 * auto-dismisses after `duration` ms (default 4000). Tapping the banner
 * re-opens the source app (see Banner.tsx handleTap) and dismisses.
 */

export interface BannerEntry {
  /** Stable id so consumers can deduplicate. Auto-generated if omitted. */
  id: string;
  title: string;
  appIcon?: string;
  appName?: string;
  /** id of the app that posted this banner. Tap → openApp(sourceAppId). */
  sourceAppId?: string;
  duration: number;
  /** Wall-clock time of arrival, used for "now" / "X 分钟前" stamps. */
  arrivedAt: number;
}

interface BannerState {
  current: BannerEntry | null;
  queue: BannerEntry[];
  show: (entry: Omit<BannerEntry, 'id' | 'arrivedAt' | 'duration'> & { id?: string; duration?: number }) => void;
  dismiss: () => void;
  clear: () => void;
}

const DEFAULT_DURATION = 4000;
let autoIdCounter = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoDismiss(duration: number): void {
  if (dismissTimer !== null) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    dismissTimer = null;
    useBannerStore.getState().dismiss();
  }, duration);
}

export const useBannerStore = create<BannerState>()((set, get) => ({
  current: null,
  queue: [],

  show: (partial) => {
    const entry: BannerEntry = {
      id: partial.id ?? `banner-${Date.now()}-${autoIdCounter++}`,
      title: partial.title,
      appIcon: partial.appIcon,
      appName: partial.appName,
      sourceAppId: partial.sourceAppId,
      duration: partial.duration ?? DEFAULT_DURATION,
      arrivedAt: Date.now(),
    };

    const state = get();
    if (state.current === null) {
      set({ current: entry });
      scheduleAutoDismiss(entry.duration);
    } else {
      set({ queue: [...state.queue, entry] });
    }
  },

  dismiss: () => {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    const state = get();
    const [next, ...rest] = state.queue;
    if (next) {
      set({ current: next, queue: rest });
      scheduleAutoDismiss(next.duration);
    } else {
      set({ current: null });
    }
  },

  clear: () => {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ current: null, queue: [] });
  },
}));
