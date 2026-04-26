/**
 * Optional model override for AI 工坊's code-generation calls. When
 * `modelOverride` is null (default), the builder uses the same provider
 * config as XingYu / heartbeat (`useAIConfigStore`). When set, the
 * specified fields override the corresponding aiConfig values.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

export interface ModelOverride {
  provider?: string;
  model?: string;
  endpoint?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAppBuilderConfigState {
  modelOverride: ModelOverride | null;
  setOverride: (o: ModelOverride | null) => void;
}

export const useAIAppBuilderConfigStore = create<AIAppBuilderConfigState>()(
  persist(
    (set) => ({
      modelOverride: null,
      setOverride: (modelOverride) => set({ modelOverride }),
    }),
    {
      name: 'hiPhone-ai-app-builder-config',
      storage: idbStorage,
      partialize: (s) => ({ modelOverride: s.modelOverride }),
    },
  ),
);
