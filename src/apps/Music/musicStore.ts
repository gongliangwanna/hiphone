import { create } from 'zustand';

export type MusicTab = 'home' | 'browse' | 'radio' | 'library';

interface MusicNavState {
  activeTab: MusicTab;
  /** null = tab root, 'now-playing' = full player, 'album-detail' = album page */
  page: string | null;
  activeAlbumId: string | null;
  showNowPlaying: boolean;

  setTab: (tab: MusicTab) => void;
  pushPage: (page: string, opts?: { albumId?: string }) => void;
  popPage: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  reset: () => void;
}

export const useMusicNavStore = create<MusicNavState>()((set) => ({
  activeTab: 'home',
  page: null,
  activeAlbumId: null,
  showNowPlaying: false,

  setTab: (tab) => set({ activeTab: tab, page: null, activeAlbumId: null }),

  pushPage: (page, opts) =>
    set({ page, activeAlbumId: opts?.albumId ?? null }),

  popPage: () => set({ page: null, activeAlbumId: null }),

  openNowPlaying: () => set({ showNowPlaying: true }),

  closeNowPlaying: () => set({ showNowPlaying: false }),

  reset: () =>
    set({
      activeTab: 'home',
      page: null,
      activeAlbumId: null,
      showNowPlaying: false,
    }),
}));
