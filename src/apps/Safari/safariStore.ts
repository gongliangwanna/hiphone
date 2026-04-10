import { create } from 'zustand';

export interface SafariTab {
  id: string;
  url: string | null;
  title: string;
  /** Simple history stack for back/forward within a tab */
  history: string[];
  historyIndex: number;
  /** Whether the iframe has loaded an error */
  hasError: boolean;
}

type SafariView = 'browse' | 'tabs';

interface SafariState {
  tabs: SafariTab[];
  activeTabId: string;
  view: SafariView;
  /** Whether the URL bar is in editing mode */
  isEditing: boolean;
  /** Text in the URL bar during editing */
  editText: string;

  // Actions
  setView: (view: SafariView) => void;
  setEditing: (editing: boolean, text?: string) => void;
  setEditText: (text: string) => void;
  navigateTo: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  switchTab: (tabId: string) => void;
  createTab: () => void;
  closeTab: (tabId: string) => void;
  setTabError: (tabId: string, hasError: boolean) => void;
  setTabTitle: (tabId: string, title: string) => void;
  reset: () => void;
}

let nextTabId = 1;

function createNewTab(): SafariTab {
  return {
    id: `tab-${nextTabId++}`,
    url: null,
    title: '起始页',
    history: [],
    historyIndex: -1,
    hasError: false,
  };
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isUrl(input: string): boolean {
  // If it has a protocol, it's a URL
  if (/^https?:\/\//i.test(input)) return true;
  // If it looks like a domain (has a dot, no spaces)
  if (/^[^\s]+\.[a-z]{2,}$/i.test(input)) return true;
  return false;
}

function normalizeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

function buildSearchUrl(query: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

const initialTab = createNewTab();

export const useSafariStore = create<SafariState>()((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  view: 'browse',
  isEditing: false,
  editText: '',

  setView: (view) => set({ view }),

  setEditing: (editing, text) => {
    if (editing) {
      const state = get();
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      set({
        isEditing: true,
        editText: text ?? tab?.url ?? '',
      });
    } else {
      set({ isEditing: false });
    }
  },

  setEditText: (text) => set({ editText: text }),

  navigateTo: (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const url = isUrl(trimmed) ? normalizeUrl(trimmed) : buildSearchUrl(trimmed);
    const domain = extractDomain(url);

    set((state) => {
      const tabs = state.tabs.map((tab) => {
        if (tab.id !== state.activeTabId) return tab;
        // Truncate forward history from current position and push new URL
        const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url];
        return {
          ...tab,
          url,
          title: domain,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          hasError: false,
        };
      });
      return { tabs, isEditing: false, view: 'browse' };
    });
  },

  goBack: () => {
    set((state) => {
      const tabs = state.tabs.map((tab) => {
        if (tab.id !== state.activeTabId) return tab;
        if (tab.historyIndex <= 0) {
          // Go back to start page
          return {
            ...tab,
            url: null,
            title: '起始页',
            historyIndex: -1,
            hasError: false,
          };
        }
        const newIndex = tab.historyIndex - 1;
        const newUrl = tab.history[newIndex]!;
        return {
          ...tab,
          url: newUrl,
          title: extractDomain(newUrl),
          historyIndex: newIndex,
          hasError: false,
        };
      });
      return { tabs };
    });
  },

  goForward: () => {
    set((state) => {
      const tabs = state.tabs.map((tab) => {
        if (tab.id !== state.activeTabId) return tab;
        if (tab.historyIndex >= tab.history.length - 1) return tab;
        const newIndex = tab.historyIndex + 1;
        const newUrl = tab.history[newIndex]!;
        return {
          ...tab,
          url: newUrl,
          title: extractDomain(newUrl),
          historyIndex: newIndex,
          hasError: false,
        };
      });
      return { tabs };
    });
  },

  canGoBack: () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return false;
    return tab.url !== null;
  },

  canGoForward: () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return false;
    return tab.historyIndex < tab.history.length - 1;
  },

  switchTab: (tabId) =>
    set({ activeTabId: tabId, view: 'browse' }),

  createTab: () => {
    const newTab = createNewTab();
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
      view: 'browse',
    }));
  },

  closeTab: (tabId) => {
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== tabId);
      if (remaining.length === 0) {
        // Always keep at least one tab
        const newTab = createNewTab();
        return {
          tabs: [newTab],
          activeTabId: newTab.id,
          view: 'browse',
        };
      }
      const needSwitch = state.activeTabId === tabId;
      return {
        tabs: remaining,
        activeTabId: needSwitch ? remaining[remaining.length - 1]!.id : state.activeTabId,
      };
    });
  },

  setTabError: (tabId, hasError) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, hasError } : t,
      ),
    }));
  },

  setTabTitle: (tabId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, title } : t,
      ),
    }));
  },

  reset: () => {
    const newTab = createNewTab();
    set({
      tabs: [newTab],
      activeTabId: newTab.id,
      view: 'browse',
      isEditing: false,
      editText: '',
    });
  },
}));

export { extractDomain };
