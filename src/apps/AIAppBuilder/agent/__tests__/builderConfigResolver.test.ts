import { describe, expect, it, beforeEach } from 'vitest';
import { resolveBuilderProviderConfig } from '../builderConfigResolver';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

describe('resolveBuilderProviderConfig', () => {
  beforeEach(() => {
    useAIConfigStore.setState({
      provider: 'openrouter',
      openRouterProviderSlug: 'cerebras',
      apiKey: ' sk-test ',
      apiEndpoint: '',
      model: ' openai/gpt-4.1 ',
      maxTokens: 1234,
      temperature: 0.2,
      topP: 0.8,
      frequencyPenalty: 0.1,
      presencePenalty: 0.2,
      reasoningEffort: 'high',
    });
  });

  it('uses the global AI settings directly', () => {
    const cfg = resolveBuilderProviderConfig();

    expect(cfg).toEqual({
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'openai/gpt-4.1',
      providerId: 'openrouter',
      openRouterProviderSlug: 'cerebras',
      generation: {
        maxTokens: 1234,
        temperature: 0.2,
        topP: 0.8,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        reasoningEffort: 'high',
      },
    });
  });

  it('throws a clear error when the global API key is missing', () => {
    useAIConfigStore.setState({ apiKey: '' });

    expect(() => resolveBuilderProviderConfig()).toThrow('请先在 AI 设置中配置 API Key');
  });

  it('throws a clear error when the global model is missing', () => {
    useAIConfigStore.setState({ model: '' });

    expect(() => resolveBuilderProviderConfig()).toThrow('请先在 AI 设置中选择模型');
  });

  it('requires an endpoint for custom providers', () => {
    useAIConfigStore.setState({
      provider: 'custom',
      apiEndpoint: '',
    });

    expect(() => resolveBuilderProviderConfig()).toThrow('请先在 AI 设置中配置 API 端点');
  });
});
