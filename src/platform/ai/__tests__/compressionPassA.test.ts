import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassA } from '../compressionPassA';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassA', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockChatJson(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('成功解析 JSON 响应', async () => {
    mockChatJson({
      factAdds: [{ content: '用户叫小明', subject: 'user', at: 1000 }],
      factAppends: [],
      loopsOpened: [{ topic: '新狗', promisedBy: 'user' }],
      loopsClosed: [],
      jokeAdds: [],
    });
    const state = makeInitialState('char-1');
    const result = await runPassA({
      state,
      messages: [{ role: 'user', speaker: '小明', content: '我叫小明，有空给你看新狗', createdAt: 1000 }],
      peers: [],
      endpoint: 'https://api.test',
      apiKey: 'sk-test',
      model: 'gpt-4',
      providerId: 'openai',
      maxTokens: 1000,
    });
    expect(result.factAdds).toHaveLength(1);
    expect(result.loopsOpened).toHaveLength(1);
  });

  it('LLM 返回非法 JSON 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    const state = makeInitialState('char-1');
    await expect(
      runPassA({
        state, messages: [], peers: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass A/);
  });

  it('支持 code block 包围的 JSON（fallback 解析）', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: {
        content: '```json\n{"factAdds":[],"factAppends":[],"loopsOpened":[],"loopsClosed":[],"jokeAdds":[]}\n```',
      } }] }),
    });
    const state = makeInitialState('char-1');
    const result = await runPassA({
      state, messages: [], peers: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(result.factAdds).toEqual([]);
  });

  it('peers 列表注入 prompt', async () => {
    mockChatJson({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    const state = makeInitialState('char-1');
    await runPassA({
      state, messages: [], peers: [{ id: 'char-2', name: '小美' }],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    const callBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const sysPrompt = callBody.messages.find((m: { role: string }) => m.role === 'system').content;
    expect(sysPrompt).toContain('小美');
  });

  it('HTTP 错误抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'oops',
    });
    const state = makeInitialState('char-1');
    await expect(
      runPassA({
        state, messages: [], peers: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass A/);
  });
});
