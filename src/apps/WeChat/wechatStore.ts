import { create } from 'zustand';

export type WeChatTab = 'chats' | 'contacts' | 'discover' | 'me';

interface WeChatNavState {
  activeTab: WeChatTab;
  /** null = tab root, 'chat-detail' = conversation view */
  page: string | null;
  activeChatId: string | null;

  setTab: (tab: WeChatTab) => void;
  pushPage: (page: string, chatId?: string) => void;
  popPage: () => void;
  reset: () => void;
}

export const useWeChatNavStore = create<WeChatNavState>()((set) => ({
  activeTab: 'chats',
  page: null,
  activeChatId: null,

  setTab: (tab) => set({ activeTab: tab, page: null, activeChatId: null }),

  pushPage: (page, chatId) =>
    set({ page, activeChatId: chatId ?? null }),

  popPage: () => set({ page: null, activeChatId: null }),

  reset: () =>
    set({ activeTab: 'chats', page: null, activeChatId: null }),
}));
