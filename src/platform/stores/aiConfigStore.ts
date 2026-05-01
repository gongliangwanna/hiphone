import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { type ModelInfo, getAdapter } from '@/platform/ai/providers';
import { uid } from '@/platform/utils/uid';

// ── Types ──────────────────────────────────────────────

/** Supported provider IDs — grows as we add adapters one-by-one */
export type ProviderId = 'openrouter' | 'siliconflow' | 'custom';

/** Per-provider connection settings, saved independently */
export interface ProviderConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  fetchedModels: ModelInfo[];
}

export interface ApiPreset {
  id: string;
  name: string;
  provider: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  fetchedModels: ModelInfo[];
}

export interface AIConfigState {
  // Connection (mirrors of active preset)
  provider: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;

  // Presets
  presets: ApiPreset[];
  activePresetId: string;

  // Per-provider saved configs (legacy, removed in Task 8)
  providerConfigs: Record<string, ProviderConfig>;

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
  /** Reasoning / thinking effort: 'off' disables, others map to reasoning_effort */
  reasoningEffort: 'off' | 'low' | 'medium' | 'high';

  // Capabilities
  /** Whether to send images as multimodal content (requires vision-capable model) */
  enableVision: boolean;

  // Context & memory
  contextWindow: number;
  worldInfoBudgetPercent: number;
  summarizeThreshold: number;
  keepRecentMessages: number;

  // Prompts
  systemPrompt: string;
  postHistoryInstructions: string;

  // Actions — presets
  createEmptyPreset: (name: string) => string;
  createPresetFromCurrent: (name: string) => string;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => boolean;
  setActivePreset: (id: string) => void;

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
  setReasoningEffort: (v: 'off' | 'low' | 'medium' | 'high') => void;

  // Actions — capabilities
  setEnableVision: (v: boolean) => void;

  // Actions — memory
  setContextWindow: (v: number) => void;
  setWorldInfoBudgetPercent: (v: number) => void;
  setSummarizeThreshold: (v: number) => void;
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

      presets: [],
      activePresetId: '',

      providerConfigs: {},

      fetchedModels: [],
      modelListLoading: false,
      modelListError: null,

      temperature: 0.8,
      maxTokens: 8192,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      reasoningEffort: 'off' as const,

      enableVision: true,

      contextWindow: 128000,
      worldInfoBudgetPercent: 25,
      summarizeThreshold: 0.8,
      keepRecentMessages: 50,

      systemPrompt: '',
      postHistoryInstructions: '',

      // ── Preset actions ──

      createEmptyPreset: (name) => {
        const trimmed = name.trim();
        const { presets } = get();
        const finalName = trimmed === '' ? `预设 ${presets.length + 1}` : trimmed;
        const newPreset: ApiPreset = {
          id: uid(),
          name: finalName,
          provider: 'openrouter',
          apiKey: '',
          apiEndpoint: '',
          model: '',
          fetchedModels: [],
        };
        set({ presets: [...presets, newPreset] });
        return newPreset.id;
      },

      createPresetFromCurrent: (name) => {
        const trimmed = name.trim();
        const { presets, provider, apiKey, apiEndpoint, model, fetchedModels } = get();
        const finalName = trimmed === '' ? `预设 ${presets.length + 1}` : trimmed;
        const newPreset: ApiPreset = {
          id: uid(),
          name: finalName,
          provider,
          apiKey,
          apiEndpoint,
          model,
          fetchedModels,
        };
        set({
          presets: [...presets, newPreset],
          activePresetId: newPreset.id,
        });
        return newPreset.id;
      },

      setActivePreset: (id) => {
        const { presets } = get();
        const target = presets.find((p) => p.id === id);
        if (!target) return;
        set({
          activePresetId: id,
          provider: target.provider,
          apiKey: target.apiKey,
          apiEndpoint: target.apiEndpoint,
          model: target.model,
          fetchedModels: target.fetchedModels,
          modelListError: null,
          modelListLoading: false,
        });
      },

      renamePreset: (id, name) => {
        const { presets } = get();
        if (!presets.some((p) => p.id === id)) return;
        const trimmed = name.trim();
        const finalName = trimmed === '' ? `预设 ${presets.length}` : trimmed;
        set({
          presets: presets.map((p) => (p.id === id ? { ...p, name: finalName } : p)),
        });
      },

      deletePreset: (id) => {
        const { presets, activePresetId } = get();
        if (presets.length <= 1) return false;
        const idx = presets.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        const next = presets.filter((p) => p.id !== id);
        if (id === activePresetId) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0]!;
          set({
            presets: next,
            activePresetId: fallback.id,
            provider: fallback.provider,
            apiKey: fallback.apiKey,
            apiEndpoint: fallback.apiEndpoint,
            model: fallback.model,
            fetchedModels: fallback.fetchedModels,
            modelListError: null,
            modelListLoading: false,
          });
        } else {
          set({ presets: next });
        }
        return true;
      },

      // ── Connection actions ──

      setProvider: (p) => {
        const { provider: prev, apiKey, apiEndpoint, model, fetchedModels, providerConfigs } = get();
        // Save current provider's config
        const saved = {
          ...providerConfigs,
          [prev]: { apiKey, apiEndpoint, model, fetchedModels },
        };
        // Restore target provider's config (or defaults)
        const target = saved[p] ?? { apiKey: '', apiEndpoint: '', model: '', fetchedModels: [] };
        set({
          provider: p,
          providerConfigs: saved,
          apiKey: target.apiKey,
          apiEndpoint: target.apiEndpoint,
          model: target.model,
          fetchedModels: target.fetchedModels,
          modelListError: null,
        });
      },
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
      setMaxTokens: (v) => set({ maxTokens: Math.max(1, Math.min(131072, v)) }),
      setTopP: (v) => set({ topP: Math.max(0, Math.min(1, v)) }),
      setFrequencyPenalty: (v) => set({ frequencyPenalty: Math.max(0, Math.min(2, v)) }),
      setPresencePenalty: (v) => set({ presencePenalty: Math.max(0, Math.min(2, v)) }),
      setReasoningEffort: (v) => set({ reasoningEffort: v }),

      setEnableVision: (v) => set({ enableVision: v }),

      // ── Memory actions ──

      setContextWindow: (v) => set({ contextWindow: v }),
      setWorldInfoBudgetPercent: (v) => set({ worldInfoBudgetPercent: Math.max(0, Math.min(100, v)) }),
      setSummarizeThreshold: (v) => set({ summarizeThreshold: Math.max(0, Math.min(1, v)) }),
      setKeepRecentMessages: (v) => set({ keepRecentMessages: Math.max(1, v) }),

      // ── Prompt actions ──

      setSystemPrompt: (s) => set({ systemPrompt: s }),
      setPostHistoryInstructions: (s) => set({ postHistoryInstructions: s }),
    }),
    {
      name: 'hiPhone-ai-config',
      storage: idbStorage,
      partialize: (s) => ({
        provider: s.provider,
        apiKey: s.apiKey,
        apiEndpoint: s.apiEndpoint,
        model: s.model,
        presets: s.presets,
        activePresetId: s.activePresetId,
        providerConfigs: s.providerConfigs,
        fetchedModels: s.fetchedModels,
        temperature: s.temperature,
        maxTokens: s.maxTokens,
        topP: s.topP,
        frequencyPenalty: s.frequencyPenalty,
        presencePenalty: s.presencePenalty,
        reasoningEffort: s.reasoningEffort,
        enableVision: s.enableVision,
        contextWindow: s.contextWindow,
        worldInfoBudgetPercent: s.worldInfoBudgetPercent,
        summarizeThreshold: s.summarizeThreshold,
        keepRecentMessages: s.keepRecentMessages,
        systemPrompt: s.systemPrompt,
        postHistoryInstructions: s.postHistoryInstructions,
      }),
    },
  ),
);

/** Helper: get the adapter for the current provider */
export { PROVIDER_ADAPTERS, getAdapter, streamChat, pickGenerationParams } from '@/platform/ai/providers';
export type { ModelInfo, GenerationParams } from '@/platform/ai/providers';
