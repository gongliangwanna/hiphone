import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickGenerationParams, streamChat } from '../providers';

describe('pickGenerationParams', () => {
  it('drops reasoningEffort when off', () => {
    const out = pickGenerationParams({
      maxTokens: 100,
      temperature: 0.5,
      reasoningEffort: 'off',
    });
    expect(out.reasoningEffort).toBeUndefined();
    expect(out.maxTokens).toBe(100);
    expect(out.temperature).toBe(0.5);
  });

  it('forwards reasoningEffort when low/medium/high', () => {
    expect(pickGenerationParams({ reasoningEffort: 'low' }).reasoningEffort).toBe('low');
    expect(pickGenerationParams({ reasoningEffort: 'medium' }).reasoningEffort).toBe('medium');
    expect(pickGenerationParams({ reasoningEffort: 'high' }).reasoningEffort).toBe('high');
  });

  it('forwards topP and penalties', () => {
    const out = pickGenerationParams({
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: 0.2,
    });
    expect(out.topP).toBe(0.9);
    expect(out.frequencyPenalty).toBe(0.3);
    expect(out.presencePenalty).toBe(0.2);
  });
});

describe('streamChat — reasoning_effort wiring', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockReset();
    // Minimal SSE-shaped stream that ends immediately.
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return {
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n'),
              };
            },
          };
        },
      },
    });
  });

  it('writes reasoning_effort into request body', async () => {
    await streamChat(
      { endpoint: 'https://api.example/v1', apiKey: 'k', model: 'm', providerId: 'openrouter' },
      [{ role: 'user', content: 'hi' }],
      () => {},
      undefined,
      { reasoningEffort: 'high' },
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.reasoning_effort).toBe('high');
  });

  it('omits reasoning_effort when not provided', async () => {
    await streamChat(
      { endpoint: 'https://api.example/v1', apiKey: 'k', model: 'm', providerId: 'openrouter' },
      [{ role: 'user', content: 'hi' }],
      () => {},
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('strictly pins OpenRouter routing to the selected provider slug', async () => {
    await streamChat(
      {
        endpoint: 'https://api.example/v1',
        apiKey: 'k',
        model: 'm',
        providerId: 'openrouter',
        openRouterProviderSlug: 'cerebras',
      },
      [{ role: 'user', content: 'hi' }],
      () => {},
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.provider).toEqual({
      only: ['cerebras'],
      allow_fallbacks: false,
    });
  });

  it('ignores OpenRouter provider slug for non-OpenRouter providers', async () => {
    await streamChat(
      {
        endpoint: 'https://api.example/v1',
        apiKey: 'k',
        model: 'm',
        providerId: 'siliconflow',
        openRouterProviderSlug: 'cerebras',
      },
      [{ role: 'user', content: 'hi' }],
      () => {},
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.provider).toBeUndefined();
  });
});
