/* ── Provider Adapter System ──
 *
 * Each AI provider implements ProviderAdapter.
 * Adapters are added one-by-one; currently: OpenRouter, SiliconFlow.
 */

// ── Types ──────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: { prompt: string; completion: string };
  ownedBy?: string;
}

export interface ProviderAdapter {
  id: string;
  label: string;
  defaultEndpoint: string;
  /** Whether fetchModels requires an API key */
  requiresKeyForModels: boolean;
  /** Fetch available models from the provider's API */
  fetchModels(apiKey: string, endpoint: string): Promise<ModelInfo[]>;
}

// ── OpenRouter ─────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture?: { modality: string };
}

const openrouter: ProviderAdapter = {
  id: 'openrouter',
  label: 'OpenRouter',
  defaultEndpoint: 'https://openrouter.ai/api/v1',
  requiresKeyForModels: false,

  async fetchModels(_apiKey, endpoint) {
    const base = endpoint || this.defaultEndpoint;
    const res = await fetch(`${base}/models`, {
      headers: { 'HTTP-Referer': 'https://hiphone.app', 'X-Title': 'hiPhone' },
    });
    if (!res.ok) throw new Error(`OpenRouter /models ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const data: OpenRouterModel[] = json.data ?? [];

    return data.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length,
      pricing: m.pricing ? { prompt: m.pricing.prompt, completion: m.pricing.completion } : undefined,
      ownedBy: m.id.split('/')[0],
    }));
  },
};

// ── SiliconFlow ────────────────────────────────────────

interface SiliconFlowModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/** Map well-known SiliconFlow model IDs to readable names */
function siliconFlowDisplayName(id: string): string {
  // id format: "org/ModelName" e.g. "deepseek-ai/DeepSeek-V3"
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

const siliconflow: ProviderAdapter = {
  id: 'siliconflow',
  label: '硅基流动',
  defaultEndpoint: 'https://api.siliconflow.cn/v1',
  requiresKeyForModels: true,

  async fetchModels(apiKey, endpoint) {
    if (!apiKey) throw new Error('硅基流动需要 API Key 才能拉取模型列表');
    const base = endpoint || this.defaultEndpoint;
    const res = await fetch(`${base}/models?sub_type=chat`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`SiliconFlow /models ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const data: SiliconFlowModel[] = json.data ?? [];

    return data
      .map((m) => ({
        id: m.id,
        name: siliconFlowDisplayName(m.id),
        ownedBy: m.owned_by,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};

// ── Chat Completion (shared — all providers are OpenAI-compatible) ──

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

export interface GenerationParams {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface OpenRouterProviderRouting {
  only: string[];
  allow_fallbacks: false;
}

export function buildOpenRouterProviderRouting(
  providerId: string,
  openRouterProviderSlug?: string,
): OpenRouterProviderRouting | undefined {
  const slug = openRouterProviderSlug?.trim();
  if (providerId !== 'openrouter' || !slug) return undefined;
  return {
    only: [slug],
    allow_fallbacks: false,
  };
}

/**
 * Map an aiConfig-shaped object to a GenerationParams. Centralizes the
 * `reasoningEffort: 'off' → undefined` rule so call sites don't each
 * re-implement it (and forget to pass the field, which is exactly how
 * the thinking-mode setting silently no-op'd before).
 */
export function pickGenerationParams(cfg: {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
}): GenerationParams {
  return {
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    topP: cfg.topP,
    frequencyPenalty: cfg.frequencyPenalty,
    presencePenalty: cfg.presencePenalty,
    reasoningEffort:
      cfg.reasoningEffort && cfg.reasoningEffort !== 'off'
        ? cfg.reasoningEffort
        : undefined,
  };
}

/**
 * Send a chat completion request and stream tokens back via callback.
 * Works for any OpenAI-compatible provider.
 */
export async function streamChat(
  {
    endpoint,
    apiKey,
    model,
    providerId,
    openRouterProviderSlug,
  }: {
    endpoint: string;
    apiKey: string;
    model: string;
    providerId: string;
    openRouterProviderSlug?: string;
  },
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
  generationParams?: GenerationParams,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    max_tokens: generationParams?.maxTokens ?? 2048,
  };
  if (generationParams?.temperature != null) body.temperature = generationParams.temperature;
  if (generationParams?.topP != null) body.top_p = generationParams.topP;
  if (generationParams?.frequencyPenalty != null) body.frequency_penalty = generationParams.frequencyPenalty;
  if (generationParams?.presencePenalty != null) body.presence_penalty = generationParams.presencePenalty;
  if (generationParams?.reasoningEffort) body.reasoning_effort = generationParams.reasoningEffort;
  const providerRouting = buildOpenRouterProviderRouting(providerId, openRouterProviderSlug);
  if (providerRouting) body.provider = providerRouting;

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onToken(delta);
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ── Custom (user-provided endpoint) ───────────────────

const custom: ProviderAdapter = {
  id: 'custom',
  label: '自定义',
  defaultEndpoint: '',
  requiresKeyForModels: true,

  async fetchModels(apiKey, endpoint) {
    if (!endpoint) throw new Error('请先填写 API 端点');
    if (!apiKey) throw new Error('请先填写 API Key');
    const res = await fetch(`${endpoint}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`/models ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const data: Array<{ id: string; owned_by?: string }> = json.data ?? [];
    return data.map((m) => ({
      id: m.id,
      name: m.id,
      ownedBy: m.owned_by,
    }));
  },
};

// ── Registry ───────────────────────────────────────────

export const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  openrouter,
  siliconflow,
  custom,
};

export type ProviderId = keyof typeof PROVIDER_ADAPTERS;

export function getAdapter(id: string): ProviderAdapter | undefined {
  return PROVIDER_ADAPTERS[id];
}
