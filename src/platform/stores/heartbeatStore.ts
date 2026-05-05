import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeartbeatCharacterConfig {
  enabled: boolean;
  /** Heartbeat interval in minutes: 15 | 30 | 60 | 120 | 240 | 480 */
  intervalMinutes: number;
  /** Max ReAct iterations per heartbeat: 5-20 */
  maxIterations: number;
  /** Max rounds when chatting with another AI character: 2-10 */
  aiChatMaxRounds: number;
  /** Generate a hidden virtual-world life story before each heartbeat. */
  virtualWorldStoryEnabled: boolean;
}

export interface HeartbeatLogEntry {
  characterId: string;
  timestamp: number;
  action: string;
  detail?: string;
}

interface HeartbeatState {
  /** Master switch */
  globalEnabled: boolean;
  /** Per-character configs, key = characterId */
  configs: Record<string, HeartbeatCharacterConfig>;
  /** Last heartbeat timestamp per character (persisted to avoid re-trigger on refresh) */
  lastHeartbeat: Record<string, number>;

  // ── Runtime (not persisted) ──
  /** Currently running characters, key = characterId, value = current iteration */
  runningCharacters: Record<string, number>;
  recentLog: HeartbeatLogEntry[];

  // ── Actions ──
  setGlobalEnabled: (v: boolean) => void;
  setCharacterConfig: (characterId: string, patch: Partial<HeartbeatCharacterConfig>) => void;
  getCharacterConfig: (characterId: string) => HeartbeatCharacterConfig;
  setLastHeartbeat: (characterId: string, ts: number) => void;
  /** Mark a character as running with current iteration count */
  setRunning: (characterId: string, iteration: number) => void;
  /** Mark a character as finished */
  clearRunning: (characterId: string) => void;
  /** Check if a specific character is currently running */
  isRunning: (characterId: string) => boolean;
  pushLog: (entry: Omit<HeartbeatLogEntry, 'timestamp'>) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: HeartbeatCharacterConfig = {
  enabled: false,
  intervalMinutes: 60,
  maxIterations: 10,
  aiChatMaxRounds: 6,
  virtualWorldStoryEnabled: false,
};

const legacyConfigCache = new WeakMap<object, HeartbeatCharacterConfig>();

const MAX_LOG_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHeartbeatStore = create<HeartbeatState>()(
  persist(
    (set, get) => ({
      globalEnabled: false,
      configs: {},
      lastHeartbeat: {},

      runningCharacters: {},
      recentLog: [],

      setGlobalEnabled: (v) => set({ globalEnabled: v }),

      setCharacterConfig: (characterId, patch) =>
        set((s) => ({
          configs: {
            ...s.configs,
            [characterId]: { ...get().getCharacterConfig(characterId), ...patch },
          },
        })),

      getCharacterConfig: (characterId) => {
        const config = get().configs[characterId];
        if (!config) return DEFAULT_CONFIG;
        if (config.virtualWorldStoryEnabled === undefined) {
          const cached = legacyConfigCache.get(config);
          if (cached) return cached;
          const normalized = { ...DEFAULT_CONFIG, ...config, virtualWorldStoryEnabled: false };
          legacyConfigCache.set(config, normalized);
          return normalized;
        }
        return config;
      },

      setLastHeartbeat: (characterId, ts) =>
        set((s) => ({
          lastHeartbeat: { ...s.lastHeartbeat, [characterId]: ts },
        })),

      setRunning: (characterId, iteration) =>
        set((s) => ({
          runningCharacters: { ...s.runningCharacters, [characterId]: iteration },
        })),

      clearRunning: (characterId) =>
        set((s) => {
          const { [characterId]: _, ...rest } = s.runningCharacters;
          return { runningCharacters: rest };
        }),

      isRunning: (characterId) => {
        return characterId in get().runningCharacters;
      },

      pushLog: (entry) =>
        set((s) => ({
          recentLog: [
            { ...entry, timestamp: Date.now() },
            ...s.recentLog,
          ].slice(0, MAX_LOG_ENTRIES),
        })),
    }),
    {
      name: 'hiPhone-heartbeat',
      storage: idbStorage,
      partialize: (s) => ({
        globalEnabled: s.globalEnabled,
        configs: s.configs,
        lastHeartbeat: s.lastHeartbeat,
        recentLog: s.recentLog,
      }),
    },
  ),
);
