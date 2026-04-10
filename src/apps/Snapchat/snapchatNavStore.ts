import { create } from 'zustand';

export type SnapchatTab = 'map' | 'chat' | 'camera' | 'community' | 'spotlight';

interface SnapchatNavState {
  activeTab: SnapchatTab;
  /** null = tab root, 'chat-detail' = conversation view */
  page: string | null;
  activeChatId: string | null;
  /** Snap ID for full-screen viewer overlay */
  viewingSnapId: string | null;

  setTab: (tab: SnapchatTab) => void;
  openChat: (chatId: string) => void;
  closeChat: () => void;
  openSnap: (snapId: string) => void;
  closeSnap: () => void;
  reset: () => void;
}

export const useSnapchatNavStore = create<SnapchatNavState>()((set) => ({
  activeTab: 'chat',
  page: null,
  activeChatId: null,
  viewingSnapId: null,

  setTab: (tab) =>
    set({ activeTab: tab, page: null, activeChatId: null }),

  openChat: (chatId) =>
    set({ page: 'chat-detail', activeChatId: chatId }),

  closeChat: () =>
    set({ page: null, activeChatId: null }),

  openSnap: (snapId) =>
    set({ viewingSnapId: snapId }),

  closeSnap: () =>
    set({ viewingSnapId: null }),

  reset: () =>
    set({
      activeTab: 'chat',
      page: null,
      activeChatId: null,
      viewingSnapId: null,
    }),
}));
