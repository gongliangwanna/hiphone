import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassC } from '../compressionPassC';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassC', () => {
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  function mock(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('解析 summary + highlights', async () => {
    mock({
      summary: '我们今天聊了换工作的事...',
      highlights: [
        { content: '她说她紧张', categories: ['striking'], weight: 0.8, at: 1000 },
      ],
    });
    const state = makeInitialState('char-1');
    const r = await runPassC({
      state, messages: [],
      characterName: '小美', userName: '小明',
      contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    expect(r.summary).toContain('换工作');
    expect(r.highlights).toHaveLength(1);
    expect(r.highlights[0]!.weight).toBe(0.8);
  });

  it('previousSummary 注入 prompt', async () => {
    mock({ summary: '', highlights: [] });
    const state = makeInitialState('char-1');
    state.episodicSummary = { content: '上次记忆', version: 1, coveringUpTo: 100, lastUpdatedAt: 200 };
    await runPassC({
      state, messages: [],
      characterName: '小美', userName: '小明', contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user').content;
    expect(userMsg).toContain('上次记忆');
  });

  it('字数约束按 contextWindow * 0.3', async () => {
    mock({ summary: '', highlights: [] });
    await runPassC({
      state: makeInitialState('char-1'), messages: [],
      characterName: '小美', userName: '小明', contextWindow: 10000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system').content;
    expect(sysMsg).toContain('3000');
  });

  it('OpenRouter 可严格限定厂商', async () => {
    mock({ summary: '', highlights: [] });
    await runPassC({
      state: makeInitialState('char-1'), messages: [],
      characterName: '小美', userName: '小明', contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x',
      providerId: 'openrouter', openRouterProviderSlug: 'cerebras',
      maxTokens: 1000,
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.provider).toEqual({ only: ['cerebras'], allow_fallbacks: false });
  });

  it('weight 越界自动 clamp', async () => {
    mock({
      summary: '',
      highlights: [
        { content: 'x', categories: ['striking'], weight: 1.5, at: 1 },
        { content: 'y', categories: ['striking'], weight: -0.3, at: 1 },
      ],
    });
    const r = await runPassC({
      state: makeInitialState('char-1'), messages: [],
      characterName: '小美', userName: '小明', contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    expect(r.highlights[0]!.weight).toBe(1);
    expect(r.highlights[1]!.weight).toBe(0);
  });
});
