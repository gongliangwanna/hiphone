/**
 * Resolve the effective LLM provider config for AI 工坊's agent.
 *
 * Precedence per field: per-builder override (`useAIAppBuilderConfigStore`)
 *   → user's `useAIConfigStore` (the same one heartbeat / XingYu use)
 *   → provider adapter's `defaultEndpoint` (for the endpoint field only).
 *
 * Mirrors the heartbeat / XingYu chat pattern. Without the adapter
 * fallback, a user with only provider+apiKey set in 设置 (no custom
 * endpoint) would get an empty endpoint string → fetch resolves it
 * against the page origin → "/chat/completions" 404 on dev server.
 *
 * Extracted from V1's builderGenerator.effectiveConfig so the agent
 * runner (S7) can call it after the V1 generator file is deleted (S10).
 *
 * See docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md S2
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { getAdapter } from '@/platform/ai/providers';
import { useAIAppBuilderConfigStore } from '../aiAppBuilderConfigStore';

export interface BuilderProviderConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
  temperature?: number;
}

export function resolveBuilderProviderConfig(): BuilderProviderConfig {
  const ai = useAIConfigStore.getState();
  const o = useAIAppBuilderConfigStore.getState().modelOverride ?? {};
  const providerId = o.provider ?? ai.provider ?? '';
  const adapter = getAdapter(providerId);
  const endpoint =
    (o.endpoint && o.endpoint.trim()) ||
    (ai.apiEndpoint && ai.apiEndpoint.trim()) ||
    adapter?.defaultEndpoint ||
    '';
  return {
    endpoint,
    apiKey: o.apiKey ?? ai.apiKey ?? '',
    model: o.model ?? ai.model ?? '',
    providerId,
    maxTokens: o.maxTokens ?? ai.maxTokens ?? 4000,
    temperature: o.temperature ?? ai.temperature,
  };
}
