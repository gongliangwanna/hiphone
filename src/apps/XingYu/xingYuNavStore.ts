import { create } from 'zustand';

export type XYTab = 'chat' | 'contacts' | 'compose' | 'moments' | 'profile';

interface XingYuNavState {
  activeTab: XYTab;
  page: string | null;
  activeChatId: string | null;
  activeIdolId: string | null;
  momentComposerOpen: boolean;
  stickerManagerOrigin: string | null;

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
  reset: () => void;
}

export const useXYNav = create<XingYuNavState>()((set, get) => ({
  activeTab: 'chat',
  page: null,
  activeChatId: null,
  activeIdolId: null,
  momentComposerOpen: false,
  stickerManagerOrigin: null,

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
  reset: () => set({ activeTab: 'chat', page: null, activeChatId: null, activeIdolId: null, momentComposerOpen: false, stickerManagerOrigin: null }),
}));
