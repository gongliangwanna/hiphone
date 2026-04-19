import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCompressionIfNeeded, installAutoCompression } from '../characterMemoryCompression';
import { useCharacterMemory, setPostAppendHook } from '../characterMemoryStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import * as summarizer from '../summarizer';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
  useCharacterStore.setState({
    characters: [{ id: 'char-001', name: '小星' } as never],
  });
  usePersonaStore.setState({
    activePersonaId: null,
    personas: [{ id: 'p', name: '小米', description: '' }],
    getActivePersona: () => ({ id: 'p', name: '小米', description: '' }),
  } as never);
});

afterEach(() => {
  setPostAppendHook(null);
});

describe('runCompressionIfNeeded', () => {
  it('no-op when entries are under token threshold', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk', model: 'x', provider: 'openrouter', apiEndpoint: '',
      contextWindow: 100_000, maxTokens: 2000,
      summarizeThreshold: 0.8, keepRecentMessages: 10,
    } as never);
    const spy = vi.spyOn(summarizer, 'compressHistory').mockResolvedValue('should-not-be-called');
    useCharacterMemory.getState().append('char-001', {
      role: 'user', speakerId: 'me', content: 'short', source: 'xingyu',
    });

    await runCompressionIfNeeded('char-001');

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('compresses the oldest batch and inserts a summary when over threshold', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk', model: 'x', provider: 'openrouter', apiEndpoint: '',
      contextWindow: 1000, maxTokens: 100,
      summarizeThreshold: 0.5, keepRecentMessages: 2,
    } as never);
    const api = useCharacterMemory.getState();
    const long = 'x'.repeat(2000);
    const e1 = api.append('char-001', { role: 'user', speakerId: 'me', content: long, source: 'xingyu' });
    /* e2 */ api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: long, source: 'xingyu' });
    const e3 = api.append('char-001', { role: 'user', speakerId: 'me', content: long, source: 'xingyu' });
    const e4 = api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: 'recent1', source: 'xingyu' });
    const e5 = api.append('char-001', { role: 'user', speakerId: 'me', content: 'recent2', source: 'xingyu' });

    const spy = vi
      .spyOn(summarizer, 'compressHistory')
      .mockResolvedValue('他们聊了很久。');

    await runCompressionIfNeeded('char-001');

    const remaining = useCharacterMemory.getState().getAll('char-001');
    // First 3 (e1-e3) collapsed to one summary entry; recent 2 (e4, e5) kept verbatim.
    expect(remaining).toHaveLength(3);
    expect(remaining[0]!).toMatchObject({
      role: 'system',
      compressed: true,
      source: 'system',
      content: expect.stringContaining('他们聊了很久。'),
    });
    expect(remaining[1]!.id).toBe(e4.id);
    expect(remaining[2]!.id).toBe(e5.id);

    expect(spy).toHaveBeenCalledOnce();
    void e1; // entry var kept for readability
    void e3;
    spy.mockRestore();
  });

  it('dedups concurrent invocations for the same charId', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk', model: 'x', provider: 'openrouter', apiEndpoint: '',
      contextWindow: 1000, maxTokens: 100,
      summarizeThreshold: 0.5, keepRecentMessages: 2,
    } as never);
    useCharacterMemory.getState().batchAppend('char-001',
      Array.from({ length: 5 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        speakerId: i % 2 === 0 ? 'me' : 'char-001',
        content: 'x'.repeat(500),
        source: 'xingyu' as const,
      })),
    );
    const spy = vi
      .spyOn(summarizer, 'compressHistory')
      .mockResolvedValue('summary');

    await Promise.all([
      runCompressionIfNeeded('char-001'),
      runCompressionIfNeeded('char-001'),
      runCompressionIfNeeded('char-001'),
    ]);

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('installAutoCompression — post-append hook wiring', () => {
  it('append schedules a compression check', async () => {
    const spy = vi
      .spyOn(summarizer, 'compressHistory')
      .mockResolvedValue('summary');
    useAIConfigStore.setState({
      apiKey: 'sk', model: 'x', provider: 'openrouter', apiEndpoint: '',
      contextWindow: 1000, maxTokens: 100,
      summarizeThreshold: 0.5, keepRecentMessages: 1,
    } as never);

    installAutoCompression();

    const api = useCharacterMemory.getState();
    api.batchAppend('char-001',
      Array.from({ length: 6 }, (_, _i) => ({
        role: 'user' as const,
        speakerId: 'me',
        content: 'x'.repeat(2000),
        source: 'xingyu' as const,
      })),
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
