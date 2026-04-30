import { create } from 'zustand';

export type SettingsPageId =
  | 'home'
  | 'about'
  | 'wallpaper'
  | 'display'
  | 'storage'
  | 'apps'
  | 'appDetail'
  | 'appIconEditor'
  | 'persona'
  | 'aiSettings'
  | 'aiTools'
  | 'aiBuilderModel'
  | 'characters'
  | 'characterEdit'
  | 'systemPromptEdit'
  | 'postHistoryEdit'
  | 'worldBooks'
  | 'worldBookEdit'
  | 'worldBookEntryEdit'
  | 'promptViewer'
  | 'modelSelect'
  | 'heartbeat'
  | 'disclaimer'
  | 'developerTools';

export interface SettingsStackItem {
  page: SettingsPageId;
  params?: Record<string, string>;
}

type PushInput = SettingsPageId | SettingsStackItem;

interface NavState {
  stack: SettingsStackItem[];
  push: (page: PushInput) => void;
  pop: () => void;
  reset: () => void;
}

function normalize(page: PushInput): SettingsStackItem {
  return typeof page === 'string' ? { page } : page;
}

export const useSettingsNavStore = create<NavState>()((set) => ({
  stack: [{ page: 'home' }],

  push: (page) =>
    set((state) => ({ stack: [...state.stack, normalize(page)] })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
    })),

  reset: () =>
    set({ stack: [{ page: 'home' }] }),
}));
