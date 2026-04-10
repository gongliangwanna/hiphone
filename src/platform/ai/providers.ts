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

// ── Registry ───────────────────────────────────────────

export const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  openrouter,
  siliconflow,
};

export type ProviderId = keyof typeof PROVIDER_ADAPTERS;

export function getAdapter(id: string): ProviderAdapter | undefined {
  return PROVIDER_ADAPTERS[id];
}
