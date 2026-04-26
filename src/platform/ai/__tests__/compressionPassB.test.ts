import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassB } from '../compressionPassB';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassB', () => {
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  function mock(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('解析 affinityDelta + stage', async () => {
    mock({
      affinityDelta: 5,
      stageChange: '密友',
      addressChange: '小明',
      boundaryAdds: [{ topic: '前任', reason: 'X', severity: 'hard' }],
      boundaryRemoves: [],
    });
    const state = makeInitialState('char-1');
    const r = await runPassB({
      state, messages: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(r.affinityDelta).toBe(5);
    expect(r.stageChange).toBe('密友');
    expect(r.boundaryAdds).toHaveLength(1);
  });

  it('缺字段时填默认', async () => {
    mock({ affinityDelta: 0 });
    const state = makeInitialState('char-1');
    const r = await runPassB({
      state, messages: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(r.boundaryAdds).toEqual([]);
    expect(r.boundaryRemoves).toEqual([]);
    expect(r.stageChange).toBeUndefined();
  });

  it('HTTP 错误抛错', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'x' });
    await expect(
      runPassB({
        state: makeInitialState('c'), messages: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass B/);
  });
});
