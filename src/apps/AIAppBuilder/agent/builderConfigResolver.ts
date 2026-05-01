/**
 * Resolve the effective LLM provider config for AI 工坊's agent.
 *
 * AI 工坊 intentionally reuses the global AI settings instead of keeping a
 * separate code-model/API override. This keeps Settings to a single source of
 * truth: the same provider, API key, endpoint, model, and generation params
 * used by the rest of the AI system.
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
import { getAdapter, pickGenerationParams, type GenerationParams } from '@/platform/ai/providers';

export interface BuilderProviderConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  generation: GenerationParams;
}

export function resolveBuilderProviderConfig(): BuilderProviderConfig {
  const ai = useAIConfigStore.getState();
  const providerId = ai.provider ?? '';
  const adapter = getAdapter(providerId);
  const endpoint =
    (ai.apiEndpoint && ai.apiEndpoint.trim()) ||
    adapter?.defaultEndpoint ||
    '';
  if (!ai.apiKey?.trim()) throw new Error('请先在 AI 设置中配置 API Key');
  if (!ai.model?.trim()) throw new Error('请先在 AI 设置中选择模型');
  if (!endpoint) throw new Error('请先在 AI 设置中配置 API 端点');

  return {
    endpoint,
    apiKey: ai.apiKey.trim(),
    model: ai.model.trim(),
    providerId,
    generation: pickGenerationParams(ai),
  };
}
