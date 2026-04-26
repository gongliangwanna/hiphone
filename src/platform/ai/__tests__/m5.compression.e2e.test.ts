import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { runCompressionForce } from '../characterMemoryCompression';
import {
  useCharacterMemory, _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

describe('M5 端到端：原始消息 → state 各层', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    useAIConfigStore.setState({
      apiKey: 'sk-test', apiEndpoint: 'https://test', model: 'gpt-4',
      provider: 'openrouter', contextWindow: 8000, summarizeThreshold: 0.8,
      maxTokens: 1000, keepRecentMessages: 0,
    } as never);
    useCharacterStore.setState({
      characters: [
        { id: 'char-1', name: '小美' },
        { id: 'char-2', name: '老周' },
      ] as never,
    } as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockChatJson(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('Pass A/B/C 全部成功 → state 完整更新；entries 标 compressed', async () => {
    mockChatJson({  // Pass A
      factAdds: [{ content: '用户在腾讯', subject: 'user', key: 'job', at: 1000 }],
      factAppends: [], loopsOpened: [{ topic: '看新狗', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    mockChatJson({  // Pass B
      affinityDelta: 5, stageChange: '朋友',
      boundaryAdds: [], boundaryRemoves: [],
    });
    mockChatJson({  // Pass C
      summary: '我们今天聊了工作和小狗',
      highlights: [{ content: '她有点害羞', categories: ['striking'], weight: 0.7, at: 1000 }],
    });

    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: '我在腾讯', source: 'xingyu',
    });
    useCharacterMemory.getState().append('char-1', {
      role: 'assistant', speakerId: 'char-1', content: '哦哦', source: 'xingyu',
    });
    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: '改天给你看新狗', source: 'xingyu',
    });

    await runCompressionForce('char-1');

    const state = useMemoryState.getState().get('char-1');
    expect(state?.factChains).toHaveLength(1);
    expect(state?.factChains[0]!.entries[0]!.content).toBe('用户在腾讯');
    expect(state?.openLoops).toHaveLength(1);
    expect(state?.relationship.affinity).toBe(55);
    expect(state?.relationship.stage).toBe('朋友');
    expect(state?.episodicSummary?.content).toContain('小狗');
    expect(state?.highlights).toHaveLength(1);

    const allEntries = useCharacterMemory.getState().getAll('char-1');
    expect(allEntries.every((e) => e.compressed)).toBe(true);
  });

  it('任一 Pass 失败 → state 不变；entries 保持未压', async () => {
    mockChatJson({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'B fail' });
    mockChatJson({ summary: '', highlights: [] });

    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: 'x', source: 'xingyu',
    });

    await runCompressionForce('char-1');

    expect(useMemoryState.getState().get('char-1')?.episodicSummary).toBeNull();
    expect(useMemoryState.getState().get('char-1')?.factChains ?? []).toEqual([]);
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => !e.compressed)).toBe(true);
  });
});
