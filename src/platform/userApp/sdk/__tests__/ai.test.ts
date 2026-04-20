import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  complete,
  streamComplete,
  getCharacters,
  extractPlainText,
  AIUnavailableError,
  AIAbortedError,
} from '../ai';
import * as aiSdk from '../ai';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import * as chatCompleteMod from '@/platform/ai/chatComplete';
import {
  _resetToolRegistryForTests,
  getTools,
} from '@/platform/ai/toolRegistry';
import {
  _resetReplyRendererRegistryForTests,
  getReplyRenderer,
  DEFAULT_REPLY_RENDERER,
} from '@/platform/ai/replyRendererRegistry';
import {
  _resetAppSystemPromptRegistryForTests,
  getAppSystemPrompt,
} from '@/platform/ai/appSystemPromptRegistry';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';

beforeEach(() => {
  useAIConfigStore.setState({
    apiKey: '',
    model: '',
    provider: 'openrouter',
    apiEndpoint: '',
    contextWindow: 8000,
    maxTokens: 1000,
  } as never);
});

describe('@hiphone/ai — complete', () => {
  it('throws AIUnavailableError when apiKey is blank', async () => {
    await expect(
      complete([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(AIUnavailableError);
  });

  it('delegates to chatComplete and returns its string', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk-xxx',
      model: 'gpt-4o-mini',
      provider: 'openrouter',
      apiEndpoint: 'https://api.example/v1',
      contextWindow: 8000,
      maxTokens: 1000,
    } as never);
    const spy = vi
      .spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValue('hello world');

    const out = await complete([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'say hi' },
    ]);
    expect(out).toBe('hello world');

    expect(spy).toHaveBeenCalledOnce();
    const [cfg, msgs, params] = spy.mock.calls[0]!;
    expect(cfg).toMatchObject({ model: 'gpt-4o-mini', providerId: 'openrouter' });
    expect(msgs).toEqual([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'say hi' },
    ]);
    expect(params).toMatchObject({ maxTokens: 1000 });
    spy.mockRestore();
  });

  it('respects options.temperature', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk',
      model: 'x',
      provider: 'openrouter',
      apiEndpoint: 'https://api.example/v1',
      contextWindow: 8000,
      maxTokens: 1000,
      temperature: 1,
    } as never);
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('ok');
    await complete([{ role: 'user', content: 'x' }], { temperature: 0.1 });
    expect(spy.mock.calls[0]![2]).toMatchObject({ temperature: 0.1 });
    spy.mockRestore();
  });
});

describe('@hiphone/ai — streamComplete', () => {
  it('yields the full reply as one chunk', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk',
      model: 'x',
      provider: 'openrouter',
      apiEndpoint: 'https://api.example/v1',
      contextWindow: 8000,
      maxTokens: 1000,
    } as never);
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('hello stream');

    const chunks: string[] = [];
    for await (const c of streamComplete([{ role: 'user', content: 'hi' }])) {
      chunks.push(c);
    }
    expect(chunks).toEqual(['hello stream']);
  });

  it('throws AIAbortedError when signal already aborted at yield time', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk',
      model: 'x',
      provider: 'openrouter',
      apiEndpoint: 'https://api.example/v1',
      contextWindow: 8000,
      maxTokens: 1000,
    } as never);

    const controller = new AbortController();
    let resolveIt!: (v: string) => void;
    vi.spyOn(chatCompleteMod, 'chatComplete').mockImplementation(
      () => new Promise((r) => { resolveIt = r; }),
    );

    const iter = streamComplete(
      [{ role: 'user', content: 'hi' }],
      { signal: controller.signal },
    );

    const consumer = (async () => {
      try {
        for await (const _ of iter) { /* empty */ }
      } catch (e) {
        return e;
      }
      return null;
    })();

    controller.abort();
    resolveIt('late');

    const err = await consumer;
    expect(err).toBeInstanceOf(AIAbortedError);
  });
});

describe('@hiphone/ai — getCharacters', () => {
  it('returns shape { id, name, avatar, description } per character', () => {
    useCharacterStore.setState({
      characters: [
        { id: 'char-1', name: '小星', avatar: 'a.jpg', description: 'd1' },
        { id: 'char-2', name: '小月', avatar: 'b.jpg', description: 'd2' },
      ] as never,
    });
    const out = getCharacters();
    expect(out).toEqual([
      { id: 'char-1', name: '小星', avatar: 'a.jpg', description: 'd1' },
      { id: 'char-2', name: '小月', avatar: 'b.jpg', description: 'd2' },
    ]);
  });

  it('fills avatar/description with empty string if absent', () => {
    useCharacterStore.setState({
      characters: [{ id: 'x', name: 'Bare' }] as never,
    });
    expect(getCharacters()).toEqual([
      { id: 'x', name: 'Bare', avatar: '', description: '' },
    ]);
  });
});

describe('@hiphone/ai — extractPlainText', () => {
  it('plain text passes through', () => {
    expect(extractPlainText('hello')).toBe('hello');
  });

  it('M4.2.5 unified JSON → text items joined with newline', () => {
    const raw =
      '[{"type":"text","param":"你好呀"},{"type":"text","param":"今天怎么样"},{"type":"sticker","param":{"stickerId":"x","content":"笑"}}]';
    expect(extractPlainText(raw)).toBe('你好呀\n今天怎么样');
  });

  it('malformed JSON → returns raw unchanged', () => {
    expect(extractPlainText('[{broken')).toBe('[{broken');
  });

  it('JSON with only non-text items → empty string (caller decides fallback)', () => {
    const raw = '[{"type":"sticker","param":{"stickerId":"x","content":"笑"}}]';
    expect(extractPlainText(raw)).toBe('');
  });

  it('non-array JSON top-level → returns raw unchanged', () => {
    expect(extractPlainText('{"type":"text","param":"hi"}')).toBe(
      '{"type":"text","param":"hi"}',
    );
  });

  it('old-format {type:"text",content} items are dropped (no content fallback)', () => {
    // Pre-M4.2.5 wire format is no longer supported; these items should be
    // filtered out. The caller's `extractPlainText(raw) || raw` pattern
    // then displays the raw JSON, which is the expected behaviour for a
    // stale LLM reply from an unmigrated deployment.
    const raw = '[{"type":"text","content":"old format"}]';
    expect(extractPlainText(raw)).toBe('');
  });
});

describe('@hiphone/ai — M4.2 registry SDK exports', () => {
  beforeEach(() => {
    _resetToolRegistryForTests();
    _resetReplyRendererRegistryForTests();
    _resetAppSystemPromptRegistryForTests();
    useCharacterMemory.getState().clearAll();
  });

  it('exports registerTools', () => {
    expect(typeof aiSdk.registerTools).toBe('function');
    aiSdk.registerTools('ai-auction', [
      { type: 'bid', description: 'd', param: '{x: number}' },
    ]);
    expect(getTools('ai-auction')).toEqual([
      { type: 'bid', description: 'd', param: '{x: number}' },
    ]);
  });

  it('exports registerReplyRenderer', () => {
    expect(typeof aiSdk.registerReplyRenderer).toBe('function');
    const r = { render: () => 'x' };
    aiSdk.registerReplyRenderer('ai-auction', r);
    expect(getReplyRenderer('ai-auction')).toBe(r);
    expect(getReplyRenderer('unused')).toBe(DEFAULT_REPLY_RENDERER);
  });

  it('exports registerAppSystemPrompt', () => {
    expect(typeof aiSdk.registerAppSystemPrompt).toBe('function');
    aiSdk.registerAppSystemPrompt('ai-auction', () => 'task-snapshot');
    expect(getAppSystemPrompt('ai-auction')!()).toBe('task-snapshot');
  });

  it('exports injectSystemEvent — writes system entry to the character', () => {
    expect(typeof aiSdk.injectSystemEvent).toBe('function');
    aiSdk.injectSystemEvent('char-001', '[拍卖] #3 流拍');
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.role).toBe('system');
    expect(entries[0]!.content).toBe('[拍卖] #3 流拍');
  });
});
