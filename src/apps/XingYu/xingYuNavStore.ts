import { create } from 'zustand';
import type { ForwardedMsg, Message } from './data';

export type XYTab = 'chat' | 'contacts' | 'compose' | 'moments' | 'profile';

export type ForwardMode = 'single' | 'batch' | 'merge';

interface PendingForward {
  msgs: Message[];
  mode: ForwardMode;
}

interface ForwardCardView {
  title: string;
  messages: ForwardedMsg[];
}

interface XingYuNavState {
  activeTab: XYTab;
  page: string | null;
  activeChatId: string | null;
  activeIdolId: string | null;
  momentComposerOpen: boolean;
  stickerManagerOrigin: string | null;
  scrollToMessageId: string | null;
  /** forward_card 详情页要展示的数据 */
  forwardCardView: ForwardCardView | null;
  /** 打开联系人选择页时暂存的待转发载荷 */
  pendingForward: PendingForward | null;

  setTab: (tab: XYTab) => void;
  openChat: (convId: string) => void;
  closeChat: () => void;
  openIdol: (idolId: string) => void;
  closeIdol: () => void;
  openMomentComposer: () => void;
  closeMomentComposer: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openStickerManager: (from?: string) => void;
  closeStickerManager: () => void;
  openChatSettings: () => void;
  closeChatSettings: () => void;
  openChatSearch: () => void;
  closeChatSearch: () => void;
  closeChatSearchToMessage: (msgId: string) => void;
  clearScrollToMessage: () => void;
  openInteractions: () => void;
  closeInteractions: () => void;
  openFavorites: () => void;
  closeFavorites: () => void;
  openForwardDetail: (view: ForwardCardView) => void;
  closeForwardDetail: () => void;
  openContactSelect: (msgs: Message[], mode: ForwardMode) => void;
  closeContactSelect: () => void;
  reset: () => void;
}

export const useXYNav = create<XingYuNavState>()((set, get) => ({
  activeTab: 'chat',
  page: null,
  activeChatId: null,
  activeIdolId: null,
  momentComposerOpen: false,
  stickerManagerOrigin: null,
  scrollToMessageId: null,
  forwardCardView: null,
  pendingForward: null,

  setTab: (tab) => set({ activeTab: tab, page: null, activeChatId: null, activeIdolId: null }),
  openChat: (convId) => set({ page: 'chat-detail', activeChatId: convId }),
  closeChat: () => set({ page: null, activeChatId: null }),
  openIdol: (idolId) => set({ page: 'idol-profile', activeIdolId: idolId }),
  closeIdol: () => set({ page: null, activeIdolId: null }),
  openMomentComposer: () => set({ momentComposerOpen: true }),
  closeMomentComposer: () => set({ momentComposerOpen: false }),
  openSettings: () => set({ page: 'settings' }),
  closeSettings: () => set({ page: null }),
  openStickerManager: (from) => set({ page: 'sticker-manager', stickerManagerOrigin: from ?? null }),
  closeStickerManager: () => {
    const origin = get().stickerManagerOrigin;
    if (origin === 'chat-detail') {
      set({ page: 'chat-detail', stickerManagerOrigin: null });
    } else {
      set({ page: null, stickerManagerOrigin: null });
    }
  },
  openChatSettings: () => set({ page: 'chat-settings' }),
  closeChatSettings: () => set({ page: 'chat-detail' }),
  openChatSearch: () => set({ page: 'chat-search' }),
  closeChatSearch: () => set({ page: 'chat-settings' }),
  closeChatSearchToMessage: (msgId) => set({ page: 'chat-detail', scrollToMessageId: msgId }),
  clearScrollToMessage: () => set({ scrollToMessageId: null }),
  openInteractions: () => set({ page: 'interactions' }),
  closeInteractions: () => set({ page: null }),
  openFavorites: () => set({ page: 'favorites' }),
  closeFavorites: () => set({ page: null }),
  openForwardDetail: (view) => set({ page: 'forward-detail', forwardCardView: view }),
  closeForwardDetail: () => set({ page: 'chat-detail', forwardCardView: null }),
  openContactSelect: (msgs, mode) => set({ page: 'contact-select', pendingForward: { msgs, mode } }),
  closeContactSelect: () => set({ page: 'chat-detail', pendingForward: null }),
  reset: () =>
    set({
      activeTab: 'chat',
      page: null,
      activeChatId: null,
      activeIdolId: null,
      momentComposerOpen: false,
      stickerManagerOrigin: null,
      scrollToMessageId: null,
      forwardCardView: null,
      pendingForward: null,
    }),
}));
