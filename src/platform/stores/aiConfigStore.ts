import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type ModelInfo, getAdapter } from '@/platform/ai/providers';

// ── Types ──────────────────────────────────────────────

/** Supported provider IDs — grows as we add adapters one-by-one */
export type ProviderId = 'openrouter' | 'siliconflow';

export interface AIConfigState {
  // Connection
  provider: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;

  // Dynamic model list (fetched from API)
  fetchedModels: ModelInfo[];
  modelListLoading: boolean;
  modelListError: string | null;

  // Generation parameters
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;

  // Context & memory
  contextWindow: number;
  worldInfoBudgetPercent: number;
  summarizeAfter: number;
  keepRecentMessages: number;

  // Prompts
  systemPrompt: string;
  postHistoryInstructions: string;

  // Actions — connection
  setProvider: (p: ProviderId) => void;
  setApiKey: (k: string) => void;
  setApiEndpoint: (url: string) => void;
  setModel: (m: string) => void;
  fetchModels: () => Promise<void>;

  // Actions — generation
  setTemperature: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setTopP: (v: number) => void;
  setFrequencyPenalty: (v: number) => void;
  setPresencePenalty: (v: number) => void;

  // Actions — memory
  setContextWindow: (v: number) => void;
  setWorldInfoBudgetPercent: (v: number) => void;
  setSummarizeAfter: (v: number) => void;
  setKeepRecentMessages: (v: number) => void;

  // Actions — prompts
  setSystemPrompt: (s: string) => void;
  setPostHistoryInstructions: (s: string) => void;
}

// ── Store ──────────────────────────────────────────────

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      provider: 'openrouter',
      apiKey: '',
      apiEndpoint: '',
      model: '',

      fetchedModels: [],
      modelListLoading: false,
      modelListError: null,

      temperature: 0.8,
      maxTokens: 2048,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,

      contextWindow: 128000,
      worldInfoBudgetPercent: 25,
      summarizeAfter: 30,
      keepRecentMessages: 50,

      systemPrompt: '',
      postHistoryInstructions: '',

      // ── Connection actions ──

      setProvider: (p) => set({ provider: p, model: '', fetchedModels: [], modelListError: null }),
      setApiKey: (k) => set({ apiKey: k }),
      setApiEndpoint: (url) => set({ apiEndpoint: url }),
      setModel: (m) => set({ model: m }),

      fetchModels: async () => {
        const { provider, apiKey, apiEndpoint } = get();
        const adapter = getAdapter(provider);
        if (!adapter) {
          set({ modelListError: `未知供应商: ${provider}` });
          return;
        }

        set({ modelListLoading: true, modelListError: null });
        try {
          const endpoint = apiEndpoint || adapter.defaultEndpoint;
          const models = await adapter.fetchModels(apiKey, endpoint);
          set({ fetchedModels: models, modelListLoading: false });
        } catch (e) {
          set({
            modelListLoading: false,
            modelListError: e instanceof Error ? e.message : String(e),
          });
        }
      },

      // ── Generation actions ──

      setTemperature: (v) => set({ temperature: Math.max(0, Math.min(2, v)) }),
      setMaxTokens: (v) => set({ maxTokens: Math.max(1, Math.min(128000, v)) }),
      setTopP: (v) => set({ topP: Math.max(0, Math.min(1, v)) }),
      setFrequencyPenalty: (v) => set({ frequencyPenalty: Math.max(0, Math.min(2, v)) }),
      setPresencePenalty: (v) => set({ presencePenalty: Math.max(0, Math.min(2, v)) }),

      // ── Memory actions ──

      setContextWindow: (v) => set({ contextWindow: v }),
      setWorldInfoBudgetPercent: (v) => set({ worldInfoBudgetPercent: Math.max(0, Math.min(100, v)) }),
      setSummarizeAfter: (v) => set({ summarizeAfter: Math.max(0, v) }),
      setKeepRecentMessages: (v) => set({ keepRecentMessages: Math.max(1, v) }),

      // ── Prompt actions ──

      setSystemPrompt: (s) => set({ systemPrompt: s }),
      setPostHistoryInstructions: (s) => set({ postHistoryInstructions: s }),
    }),
    {
      name: 'hiPhone-ai-config',
      partialize: (s) => ({
        provider: s.provider,
        apiKey: s.apiKey,
        apiEndpoint: s.apiEndpoint,
        model: s.model,
        fetchedModels: s.fetchedModels,
        temperature: s.temperature,
        maxTokens: s.maxTokens,
        topP: s.topP,
        frequencyPenalty: s.frequencyPenalty,
        presencePenalty: s.presencePenalty,
        contextWindow: s.contextWindow,
        worldInfoBudgetPercent: s.worldInfoBudgetPercent,
        summarizeAfter: s.summarizeAfter,
        keepRecentMessages: s.keepRecentMessages,
        systemPrompt: s.systemPrompt,
        postHistoryInstructions: s.postHistoryInstructions,
      }),
    },
  ),
);

/** Helper: get the adapter for the current provider */
export { PROVIDER_ADAPTERS, getAdapter } from '@/platform/ai/providers';
export type { ModelInfo } from '@/platform/ai/providers';
