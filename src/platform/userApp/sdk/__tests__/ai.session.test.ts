import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatWithCharacter,
  AICharacterNotFoundError,
  AIAbortedError,
} from '../ai';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { withUserAppContext } from '../context';
import * as chatCompleteMod from '@/platform/ai/chatComplete';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
  useCharacterStore.setState({
    characters: [
      {
        id: 'char-001',
        name: '小星',
        description: '',
        personality: '',
        scenario: '',
        systemPrompt: '',
        postHistoryInstructions: '',
        messageExamples: '',
      },
    ] as never,
  });
  usePersonaStore.setState({
    activePersonaId: null,
    personas: [{ id: 'p', name: '小米', description: '' }],
    getActivePersona: () => ({ id: 'p', name: '小米', description: '' }),
  } as never);
  useAIConfigStore.setState({
    apiKey: 'sk',
    model: 'x',
    provider: 'openrouter',
    apiEndpoint: 'https://api.example/v1',
    contextWindow: 100_000,
    maxTokens: 2000,
    keepRecentMessages: 10,
    worldInfoBudgetPercent: 0.3,
    enableVision: false,
    systemPrompt: '',
    postHistoryInstructions: '',
  } as never);
});

describe('chatWithCharacter — creation', () => {
  it('throws AICharacterNotFoundError for unknown charId', () => {
    expect(() => chatWithCharacter('missing')).toThrow(AICharacterNotFoundError);
  });

  it('defaults to persistent=false', () => {
    const s = chatWithCharacter('char-001');
    expect(s.persistent).toBe(false);
    expect(s.characterId).toBe('char-001');
    expect(s.history).toEqual([]);
  });

  it('persistent=true reflects in the session', () => {
    const s = chatWithCharacter('char-001', { persistent: true });
    expect(s.persistent).toBe(true);
  });
});

describe('chatWithCharacter — append rules', () => {
  it('persistent=false + default mirror: updates session.history, NOT memoryStore', () => {
    const s = chatWithCharacter('char-001');
    s.append({ role: 'user', content: 'hi' });
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.content).toBe('hi');
    expect(s.history[0]!.speakerId).toBe('me');
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });

  it('persistent=true + mirror:true: writes to both session.history and memoryStore', () => {
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    withUserAppContext('app-demo', () => {
      s.append({ role: 'user', content: 'hello' });
    });
    expect(s.history).toHaveLength(1);
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(1);
    expect(mem[0]!.source).toBe('app:app-demo');
    expect(mem[0]!.content).toBe('hello');
    expect(mem[0]!.speakerId).toBe('me');
  });

  it('persistent=true + mirror:false: updates session.history only', () => {
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    s.append({ role: 'user', content: 'hi' }, { mirror: false });
    expect(s.history).toHaveLength(1);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });

  it('append can specify a custom speakerId (for observer/XingYu scenarios)', () => {
    const s = chatWithCharacter('char-001');
    s.append({ role: 'user', content: '你好', speakerId: 'char-002' });
    expect(s.history[0]!.speakerId).toBe('char-002');
  });
});

describe('session.send (non-streaming)', () => {
  it('persistent=false: appends user+assistant to buffer, does NOT touch memoryStore', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply A');
    const s = chatWithCharacter('char-001');
    const reply = await s.send('hello');

    expect(reply).toBe('reply A');
    expect(s.history.map((e) => e.content)).toEqual(['hello', 'reply A']);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });

  it('persistent=true + mirror:true: writes both user and reply to memoryStore', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply B');
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    const reply = await withUserAppContext('app-demo', () => s.send('hello'));

    expect(reply).toBe('reply B');
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(2);
    expect(mem[0]!).toMatchObject({ role: 'user', speakerId: 'me', content: 'hello', source: 'app:app-demo' });
    expect(mem[1]!).toMatchObject({ role: 'assistant', speakerId: 'char-001', content: 'reply B', source: 'app:app-demo' });
  });

  it('persistent=true + mirror:false: buffer updated, memoryStore untouched', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply C');
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    const reply = await withUserAppContext('app-demo', () => s.send('hello', { mirror: false }));

    expect(reply).toBe('reply C');
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
    expect(s.history).toHaveLength(2);
  });
});

describe('session.replyToLast', () => {
  it('triggers a reply to current buffer state (persistent=false keeps it local)', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply D');
    const s = chatWithCharacter('char-001');
    s.append({ role: 'user', content: 'hi' });
    const reply = await s.replyToLast();

    expect(reply).toBe('reply D');
    expect(s.history.map((e) => e.content)).toEqual(['hi', 'reply D']);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });
});

describe('session.streamSend', () => {
  it('yields the full reply as one chunk', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('hello world');
    const s = chatWithCharacter('char-001');

    const chunks: string[] = [];
    for await (const c of s.streamSend('hi')) chunks.push(c);
    expect(chunks).toEqual(['hello world']);
    expect(s.history.map((e) => e.content)).toEqual(['hi', 'hello world']);
  });

  it('abort() mid-stream → throws AIAbortedError', async () => {
    let resolveIt!: (v: string) => void;
    vi.spyOn(chatCompleteMod, 'chatComplete').mockImplementation(
      () => new Promise((r) => { resolveIt = r; }),
    );

    const s = chatWithCharacter('char-001');
    const iter = s.streamSend('hi');

    const consumer = (async () => {
      try {
        for await (const _ of iter) { /* empty */ }
      } catch (e) {
        return e;
      }
      return null;
    })();

    s.abort();
    resolveIt('late');

    const err = await consumer;
    expect(err).toBeInstanceOf(AIAbortedError);
  });
});
