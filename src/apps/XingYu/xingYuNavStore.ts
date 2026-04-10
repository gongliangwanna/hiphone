import { create } from 'zustand';

export type XYTab = 'chat' | 'moments' | 'profile';

interface XingYuNavState {
  activeTab: XYTab;
  page: string | null;
  activeChatId: string | null;
  activeIdolId: string | null;
  momentComposerOpen: boolean;

  setTab: (tab: XYTab) => void;
  openChat: (convId: string) => void;
  closeChat: () => void;
  openIdol: (idolId: string) => void;
  closeIdol: () => void;
  openMomentComposer: () => void;
  closeMomentComposer: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  reset: () => void;
}

export const useXYNav = create<XingYuNavState>()((set) => ({
  activeTab: 'chat',
  page: null,
  activeChatId: null,
  activeIdolId: null,
  momentComposerOpen: false,

  setTab: (tab) => set({ activeTab: tab, page: null, activeChatId: null, activeIdolId: null }),
  openChat: (convId) => set({ page: 'chat-detail', activeChatId: convId }),
  closeChat: () => set({ page: null, activeChatId: null }),
  openIdol: (idolId) => set({ page: 'idol-profile', activeIdolId: idolId }),
  closeIdol: () => set({ page: null, activeIdolId: null }),
  openMomentComposer: () => set({ momentComposerOpen: true }),
  closeMomentComposer: () => set({ momentComposerOpen: false }),
  openSettings: () => set({ page: 'settings' }),
  closeSettings: () => set({ page: null }),
  reset: () => set({ activeTab: 'chat', page: null, activeChatId: null, activeIdolId: null, momentComposerOpen: false }),
}));
