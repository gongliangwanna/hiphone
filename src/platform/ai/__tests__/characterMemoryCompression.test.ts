import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { runCompressionIfNeeded, runCompressionForce } from '../characterMemoryCompression';
import { useCharacterMemory, _resetCharacterMemoryForTests } from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import * as pipeline from '../compressionPipeline';
import { makeInitialState } from '../memoryStateTypes';

describe('characterMemoryCompression', () => {
  let pipelineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
    useAIConfigStore.setState({
      apiKey: 'sk-test',
      apiEndpoint: 'https://x',
      model: 'gpt-4',
      provider: 'openrouter',
      contextWindow: 1000,
      summarizeThreshold: 0.5,
      maxTokens: 500,
      keepRecentMessages: 0,
    } as never);
    useCharacterStore.setState({
      characters: [{ id: 'char-1', name: '小美' } as never],
    } as never);
    pipelineSpy = vi.spyOn(pipeline, 'runCompressionPipeline');
  });
  afterEach(() => pipelineSpy.mockRestore());

  function pushMessages(count: number): void {
    const big = 'x'.repeat(500);
    for (let i = 0; i < count; i++) {
      useCharacterMemory.getState().append('char-1', {
        role: 'user', speakerId: 'me', content: big, source: 'xingyu',
      });
    }
  }

  it('未超阈值不触发', async () => {
    pushMessages(1);
    await runCompressionIfNeeded('char-1');
    expect(pipelineSpy).not.toHaveBeenCalled();
  });

  it('超阈值触发，state 写入', async () => {
    pipelineSpy.mockImplementation(async () => {
      const s = makeInitialState('char-1');
      s.episodicSummary = { content: 'mock', version: 1, coveringUpTo: 1, lastUpdatedAt: 1 };
      return s;
    });
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    expect(pipelineSpy).toHaveBeenCalledOnce();
    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toBe('mock');
  });

  it('成功后旧 entries 被标 compressed', async () => {
    pipelineSpy.mockImplementation(async () => makeInitialState('char-1'));
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => e.compressed)).toBe(true);
  });

  it('pipeline 失败 → entries 保持未压', async () => {
    pipelineSpy.mockRejectedValue(new Error('boom'));
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => !e.compressed)).toBe(true);
  });

  it('runCompressionForce 即使未超阈值也跑', async () => {
    pipelineSpy.mockImplementation(async () => makeInitialState('char-1'));
    pushMessages(1);
    await runCompressionForce('char-1');
    expect(pipelineSpy).toHaveBeenCalledOnce();
  });

  it('in-flight dedup', async () => {
    let resolve: (v: never) => void = null!;
    pipelineSpy.mockImplementation(() => new Promise((r) => { resolve = r as never; }));
    pushMessages(5);
    const a = runCompressionIfNeeded('char-1');
    const b = runCompressionIfNeeded('char-1');
    expect(a).toBe(b);
    resolve(makeInitialState('char-1') as never);
    await a;
  });
});
