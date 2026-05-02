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
import * as promptAssemblyMod from '@/platform/ai/promptAssembly';
import {
  _resetCharacterAppStateForTests,
  getLastActiveAppId,
} from '@/platform/ai/characterAppState';
import {
  registerTools,
  _resetToolRegistryForTests,
} from '@/platform/ai/toolRegistry';
import {
  registerAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import {
  registerReplyRenderer,
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import { parseReply } from '@/platform/ai/replyParser';
import * as toastMod from '../toast';

beforeEach(() => {
  _resetCharacterAppStateForTests();
  _resetToolRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetReplyRendererRegistryForTests();
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
    // mem[0] is the auto-injected [上下文切换] marker for app-demo (first
    // session ever), mem[1] is the appended user message.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(2);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!.source).toBe('app:app-demo');
    expect(mem[1]!.content).toBe('hello');
    expect(mem[1]!.speakerId).toBe('me');
  });

  it('persistent=true + mirror:false: updates session.history only', () => {
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    s.append({ role: 'user', content: 'hi' }, { mirror: false });
    expect(s.history).toHaveLength(1);
    // Creation of the session injects one [上下文切换] marker; the
    // mirror=false append itself does not touch memoryStore.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(1);
    expect(mem[0]!.role).toBe('system');
  });

  it('append can specify a custom speakerId (for observer/XingYu scenarios)', () => {
    const s = chatWithCharacter('char-001');
    s.append({ role: 'user', content: '你好', speakerId: 'char-002' });
    expect(s.history[0]!.speakerId).toBe('char-002');
  });
});

describe('session.send (non-streaming)', () => {
  it('persistent=false: appends user+assistant to buffer, does NOT touch memoryStore', async () => {
    // M4.2.5 S2: send/replyToLast now require valid {type,param} JSON —
    // non-JSON triggers the 3-attempt retry loop. Use a well-formed mock.
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"reply A"}]',
    );
    const s = chatWithCharacter('char-001');
    const reply = await s.send('hello');

    expect(reply.raw).toBe('[{"type":"text","param":"reply A"}]');
    expect(reply.rendered).toBe('reply A');
    expect(s.history.map((e) => e.content)).toEqual(['hello', 'reply A']);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });

  it('persistent=true + mirror:true: writes both user and reply to memoryStore', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"reply B"}]',
    );
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    const reply = await withUserAppContext('app-demo', () => s.send('hello'));

    expect(reply.raw).toBe('[{"type":"text","param":"reply B"}]');
    expect(reply.rendered).toBe('reply B');
    // mem[0] is the session-creation [上下文切换] marker, then user + reply.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(3);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!).toMatchObject({ role: 'user', speakerId: 'me', content: 'hello', source: 'app:app-demo' });
    // Assistant entry now stores the RENDERED form, not the raw string.
    expect(mem[2]!).toMatchObject({ role: 'assistant', speakerId: 'char-001', content: 'reply B', source: 'app:app-demo' });
  });

  it('persistent=true + mirror:false: buffer updated, memoryStore gets only the creation marker', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"reply C"}]',
    );
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    const reply = await withUserAppContext('app-demo', () => s.send('hello', { mirror: false }));

    expect(reply.raw).toBe('[{"type":"text","param":"reply C"}]');
    expect(reply.rendered).toBe('reply C');
    // Creation still injects one [上下文切换] marker; mirror:false keeps the
    // actual user/assistant turns out of memoryStore.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(1);
    expect(mem[0]!.role).toBe('system');
    expect(s.history).toHaveLength(2);
  });
});

describe('session.replyToLast', () => {
  it('triggers a reply to current buffer state (persistent=false keeps it local)', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"reply D"}]',
    );
    const s = chatWithCharacter('char-001');
    s.append({ role: 'user', content: 'hi' });
    const reply = await s.replyToLast();

    expect(reply.raw).toBe('[{"type":"text","param":"reply D"}]');
    expect(reply.rendered).toBe('reply D');
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
    // streamSend still yields RAW tokens for streaming consumers.
    expect(chunks).toEqual(['hello world']);
    // Buffer records the RENDERED form (non-JSON input falls back to a
    // single text item, which the default renderer wraps).
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

describe('chatWithCharacter — app-switch system marker', () => {
  it('first-ever session (lastActiveAppId is null) injects "[上下文切换] 用户打开了 <appName>"', () => {
    withUserAppContext('ai-auction', () => {
      chatWithCharacter('char-001', { persistent: true });
    });
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.role).toBe('system');
    expect(entries[0]!.source).toBe('system');
    expect(entries[0]!.content).toMatch(/上下文切换/);
    expect(entries[0]!.content).toMatch(/ai-auction/);
    expect(getLastActiveAppId('char-001')).toBe('ai-auction');
  });

  it('second session in the SAME app does not inject another marker', () => {
    withUserAppContext('ai-auction', () => {
      chatWithCharacter('char-001', { persistent: true });
    });
    withUserAppContext('ai-auction', () => {
      chatWithCharacter('char-001', { persistent: true });
    });
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries).toHaveLength(1); // only the first marker
  });

  it('switching apps injects a second marker naming both sides', () => {
    withUserAppContext('ai-auction', () => {
      chatWithCharacter('char-001', { persistent: true });
    });
    withUserAppContext('xingyu', () => {
      chatWithCharacter('char-001', { persistent: true });
    });
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries).toHaveLength(2);
    expect(entries[1]!.content).toMatch(/从 ai-auction/);
    expect(entries[1]!.content).toMatch(/切到了 xingyu/);
    expect(getLastActiveAppId('char-001')).toBe('xingyu');
  });

  it('persistent=false sessions still update lastActiveAppId + inject the marker (they still occupy the scene)', () => {
    withUserAppContext('ai-auction', () => {
      chatWithCharacter('char-001', { persistent: false });
    });
    // Marker lands in memoryStore even though the session itself is a clone —
    // scene state is character-scoped, not session-scoped.
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(1);
    expect(getLastActiveAppId('char-001')).toBe('ai-auction');
  });

  it('no sandbox context + no recorded app: no marker (fallback "unknown" does not trigger)', () => {
    // The test runs OUTSIDE withUserAppContext — getCurrentAppId throws.
    // The catch branch yields capturedAppId = null → sessionAppId = 'unknown'.
    // lastActiveAppId is also null; we must NOT inject a marker in this edge
    // case, otherwise every test fixture would get a spurious "[上下文切换] unknown" entry.
    chatWithCharacter('char-001', { persistent: true });
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
    expect(getLastActiveAppId('char-001')).toBeNull();
  });
});

describe('chatWithCharacter — session captures registry snapshots at creation', () => {
  it('captures getTools(appId) + appSystemPromptRegistry.get(appId)() + appId once at creation time, passes through to assemblePrompt on every send', async () => {
    registerTools('ai-auction', [
      { type: 'bid_call', description: '叫价', param: '{min: number}' },
    ]);
    registerAppSystemPrompt('ai-auction', () => '你是拍卖会主持人');

    const spy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');

    await withUserAppContext('ai-auction', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('请主持');
    });

    expect(spy).toHaveBeenCalled();
    const input = spy.mock.calls[0]![0];
    expect(input.currentAppId).toBe('ai-auction');
    expect(input.availableTools).toEqual([
      { type: 'bid_call', description: '叫价', param: '{min: number}' },
    ]);
    expect(input.appSystemPromptSnapshot).toBe('你是拍卖会主持人');

    spy.mockRestore();
    chatSpy.mockRestore();
  });

  it('snapshot is frozen at creation — mutations to the registry AFTER session creation do not leak in', async () => {
    registerAppSystemPrompt('ai-auction', () => 'initial');
    const spy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');

    await withUserAppContext('ai-auction', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      // Simulate the app mutating its state after session created
      registerAppSystemPrompt('ai-auction', () => 'mutated');
      await s.send('hi');
    });

    const input = spy.mock.calls[0]![0];
    expect(input.appSystemPromptSnapshot).toBe('initial'); // frozen

    spy.mockRestore();
    chatSpy.mockRestore();
  });

  it('session without app context leaves the three fields as undefined/empty', async () => {
    const spy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');

    // No withUserAppContext — getCurrentAppId throws, capturedAppId is null
    const s = chatWithCharacter('char-001', { persistent: true });
    await s.send('hi');

    const input = spy.mock.calls[0]![0];
    expect(input.currentAppId).toBeUndefined();
    expect(input.availableTools).toEqual([]);
    expect(input.appSystemPromptSnapshot).toBeUndefined();

    spy.mockRestore();
    chatSpy.mockRestore();
  });
});

describe('chatWithCharacter — ChatReply shape (M4.2.5)', () => {
  it('send returns ChatReply with raw + rendered + items (unified {type, param})', async () => {
    const rawJson = '[{"type":"text","param":"挺好"},{"type":"bid_call","param":{"min":100}}]';
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(rawJson);

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('开拍');
    });

    expect(reply.raw).toBe(rawJson);
    expect(reply.items).toEqual([
      { type: 'text', param: '挺好' },
      { type: 'bid_call', param: { min: 100 } },
    ]);
    const actions = reply.items.filter((i) => i.type !== 'text');
    expect(actions).toEqual([{ type: 'bid_call', param: { min: 100 } }]);
    const texts = reply.items.filter((i) => i.type === 'text').map((i) => i.param);
    expect(texts).toEqual(['挺好']);
    // Default renderer, no app-specific override → goes through defaultReplyRenderer
    expect(reply.rendered).toBe('挺好\n【bid_call】{"min":100}');
  });

  it('mirror=true writes reply.rendered (not raw) into memoryStore', async () => {
    const rawJson = '[{"type":"text","param":"你好"}]';
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(rawJson);

    await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('hi');
    });

    const mem = useCharacterMemory.getState().getAll('char-001');
    const assistantEntry = mem.find((e) => e.role === 'assistant')!;
    expect(assistantEntry.content).toBe('你好'); // rendered, not raw JSON
  });

  it('session.history assistant entry also holds rendered text', async () => {
    const rawJson = '[{"type":"text","param":"再见"}]';
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(rawJson);

    const s = await withUserAppContext('app-test', async () => {
      const session = chatWithCharacter('char-001', { persistent: true });
      await session.send('bye');
      return session;
    });

    const assistantInBuffer = s.history.find((h) => h.role === 'assistant')!;
    expect(assistantInBuffer.content).toBe('再见');
  });

  it('app-specific renderer (registered via replyRendererRegistry) drives rendered output', async () => {
    registerReplyRenderer('app-test', {
      render(raw, ctx) {
        const { items } = parseReply(raw, new Set());
        return `[CUSTOM ${ctx.speakerName}] ${items.length} items`;
      },
    });
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[{"type":"text","param":"a"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('hi');
    });

    expect(reply.rendered).toBe('[CUSTOM 小星] 1 items');
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem.find((e) => e.role === 'assistant')!.content).toBe('[CUSTOM 小星] 1 items');
  });

  it('mirror=false: session.history + rendered shape still computed, but memoryStore NOT written', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[{"type":"text","param":"x"}]');

    const { reply, historyAssistant } = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      const r = await s.send('q', { mirror: false });
      return { reply: r, historyAssistant: s.history.find((h) => h.role === 'assistant')! };
    });

    expect(reply.rendered).toBe('x');
    expect(historyAssistant.content).toBe('x'); // buffer always rendered
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(1); // only the [上下文切换] marker from S2; no assistant
  });

  it('replyToLast returns ChatReply with the same shape semantics', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[{"type":"text","param":"re-reply"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      s.append({ role: 'user', content: 'context' });
      return s.replyToLast();
    });

    expect(reply.raw).toBe('[{"type":"text","param":"re-reply"}]');
    expect(reply.rendered).toBe('re-reply');
    const texts = reply.items.filter((i) => i.type === 'text').map((i) => i.param);
    expect(texts).toEqual(['re-reply']);
  });
});

describe('chatWithCharacter — parse-error retry (M4.2.5 S2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries up to 3 times on parse failure, succeeds on 3rd, commits ONLY the final reply', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce('[{"bad":"shape"}]')
      .mockResolvedValueOnce('[{"type":"text","param":"finally ok"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('hi');
    });

    expect(reply.raw).toBe('[{"type":"text","param":"finally ok"}]');
    expect(reply.items).toEqual([{ type: 'text', param: 'finally ok' }]);

    // M4.x bugfix: failure raws + parse error notices are TRANSIENT (only
    // visible to the LLM via retryNudges within this send call). They must
    // NOT pollute long-term memory or the user-visible chat thread.
    const mem = useCharacterMemory.getState().getAll('char-001');
    // [0] switch marker, [1] user 'hi', [2] final assistant 'finally ok'
    expect(mem).toHaveLength(3);
    expect(mem.find((e) => e.content === 'not json at all')).toBeUndefined();
    expect(mem.find((e) => e.content === '[{"bad":"shape"}]')).toBeUndefined();
    expect(
      mem.find((e) => e.role === 'system' && e.content.includes('[格式错误]')),
    ).toBeUndefined();
    expect(mem[1]!.role).toBe('user');
    expect(mem[1]!.content).toBe('hi');
    expect(mem[2]!.role).toBe('assistant');
    expect(mem[2]!.content).toBe('finally ok');
  });

  it('retry threads transient nudges into the LLM prompt for self-correction', async () => {
    // Even though failures are not persisted, the LLM on attempt 2/3 must
    // see attempt 1's bad raw + the corrective system message — otherwise it
    // can't self-correct. This is delivered via callLLM's transient
    // retryNudges parameter, not via the session buffer or memoryStore.
    const promptSpy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('[{"type":"text","param":"corrected"}]');

    await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('hi');
    });

    expect(promptSpy).toHaveBeenCalledTimes(2);
    const secondArgs = promptSpy.mock.calls[1]![0] as {
      memoryEntries: ReadonlyArray<{ role: string; content: string }>;
    };
    expect(
      secondArgs.memoryEntries.some(
        (e) => e.role === 'assistant' && e.content === 'not json',
      ),
    ).toBe(true);
    expect(
      secondArgs.memoryEntries.some(
        (e) => e.role === 'system' && e.content.includes('[格式错误]'),
      ),
    ).toBe(true);
  });

  it('3 consecutive failures → empty-items ChatReply + toast, NO failure pollution in memory', async () => {
    const toastSpy = vi.spyOn(toastMod, 'show').mockImplementation(() => {});
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('total garbage non json');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('please');
    });

    expect(reply.items).toEqual([]);
    expect(reply.rendered).toBe('[生成失败]');

    // M4.x bugfix: exhaustion no longer commits the bad raws or the
    // "已放弃重试" summary. Only the user's input and the auto switch marker
    // remain in memory.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(2);
    expect(mem[1]!.role).toBe('user');
    expect(mem[1]!.content).toBe('please');
    expect(
      mem.find((e) => e.content === 'total garbage non json'),
    ).toBeUndefined();
    expect(
      mem.find((e) => e.content.includes('已放弃重试')),
    ).toBeUndefined();
    expect(
      mem.find((e) => e.content.includes('[格式错误]')),
    ).toBeUndefined();

    // Default toast still fires for caller-visible feedback.
    expect(toastSpy).toHaveBeenCalledWith('AI 回复格式错误');
  });

  it('unknown-type error: corrective nudge reaches the retry prompt but never memory', async () => {
    const promptSpy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"order_pizza","param":{}}]')
      .mockResolvedValueOnce('[{"type":"text","param":"sorry"}]');

    registerTools('app-test', [
      { type: 'text', description: '', param: 'string' },
      { type: 'sticker', description: '', param: '{}' },
    ]);

    await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('hi');
    });

    // The retry's corrective system message lists the valid types — visible
    // to the LLM via retryNudges, NOT via memoryStore.
    const secondArgs = promptSpy.mock.calls[1]![0] as {
      memoryEntries: ReadonlyArray<{ role: string; content: string }>;
    };
    const nudge = secondArgs.memoryEntries.find(
      (e) => e.role === 'system' && e.content.includes('未注册的 type'),
    );
    expect(nudge).toBeDefined();
    expect(nudge!.content).toMatch(/order_pizza/);
    expect(nudge!.content).toMatch(/text, sticker/);

    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(
      mem.find((e) => e.role === 'system' && e.content.includes('未注册的 type')),
    ).toBeUndefined();
  });

  it('onParseFailure callback suppresses default toast', async () => {
    const toastSpy = vi.spyOn(toastMod, 'show').mockImplementation(() => {});
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('bad');
    const callback = vi.fn();

    await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', {
        persistent: true,
        onParseFailure: callback,
      });
      return s.send('hi');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ raw: 'bad', attempts: 3 }),
    );
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('mirror:false suppresses ALL memoryStore writes including parse failures', async () => {
    // Bug fix: previously the retry path wrote bad raws + system errors to
    // memoryStore even with mirror:false, leaking transient failures into
    // long-term memory. mirror:false must mean "this entire send() is
    // invisible to long-term memory — successes AND failures alike".
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('bad1')
      .mockResolvedValueOnce('[{"type":"text","param":"ok"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('hi', { mirror: false });
    });

    // Retry still self-corrected — final reply is the success raw.
    expect(reply.raw).toBe('[{"type":"text","param":"ok"}]');

    const mem = useCharacterMemory.getState().getAll('char-001');
    // No bad raw, no system error, no success rendered, no user input.
    expect(mem.find((e) => e.content === 'bad1')).toBeUndefined();
    expect(
      mem.find((e) => e.role === 'system' && e.content.includes('[格式错误]')),
    ).toBeUndefined();
    expect(mem.find((e) => e.content === 'hi')).toBeUndefined();
    // Only the switch marker (system event from session creation) should remain.
    const nonSystemEvents = mem.filter((e) => e.source !== 'system');
    expect(nonSystemEvents).toHaveLength(0);
  });

  it('persistent=false: parse failures do NOT pollute memoryStore', async () => {
    // Bug fix: persistent=false sessions should be fully isolated from long-
    // term memory. Previously the retry path wrote failure entries to memory
    // even when persistent=false (which doesn't even help retry, since
    // persistent=false reads from a frozen snapshot).
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('total garbage');

    // Seed prior memory so we can detect any leakage by content.
    useCharacterMemory.getState().append('char-001', {
      role: 'user',
      speakerId: 'me',
      content: 'pre-existing',
      source: 'xingyu',
    });

    await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: false });
      await s.send('hello');
    });

    const mem = useCharacterMemory.getState().getAll('char-001');
    // No user input, no failed raws, no system parse errors, no exhaustion
    // summary. The auto app-switch marker (source: 'system') is unrelated to
    // this bug and may be present.
    expect(mem.find((e) => e.content === 'hello')).toBeUndefined();
    expect(mem.find((e) => e.content === 'total garbage')).toBeUndefined();
    expect(
      mem.find((e) => e.content.includes('[格式错误]')),
    ).toBeUndefined();
    expect(
      mem.find((e) => e.content.includes('已放弃重试')),
    ).toBeUndefined();
  });

  it('persistent=false: retry self-corrects via transient nudges (no buffer/memory pollution)', async () => {
    // For persistent=false sessions the retry must still see attempt 1's bad
    // raw + corrective system message so it can self-correct on attempt 2 —
    // delivered via callLLM's transient retryNudges, not via session buffer
    // or memoryStore (both stay clean).
    const promptSpy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('[{"type":"text","param":"ok"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: false });
      return s.send('hi');
    });

    expect(reply.raw).toBe('[{"type":"text","param":"ok"}]');

    // Second assemblePrompt call should have seen the bad raw + system error
    // in its memoryEntries (via the buffer overlay), so the LLM had context
    // to self-correct.
    expect(promptSpy).toHaveBeenCalledTimes(2);
    const secondCallArgs = promptSpy.mock.calls[1]![0] as {
      memoryEntries: ReadonlyArray<{ role: string; content: string }>;
    };
    expect(
      secondCallArgs.memoryEntries.some(
        (e) => e.role === 'assistant' && e.content === 'not json',
      ),
    ).toBe(true);
    expect(
      secondCallArgs.memoryEntries.some(
        (e) => e.role === 'system' && e.content.includes('[格式错误]'),
      ),
    ).toBe(true);
  });

  it('replyToLast also respects the retry loop + onParseFailure', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('bad1')
      .mockResolvedValueOnce('bad2')
      .mockResolvedValueOnce('[{"type":"text","param":"third time lucky"}]');

    const reply = await withUserAppContext('app-test', async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      s.append({ role: 'user', content: 'context' });
      return s.replyToLast();
    });

    expect(reply.raw).toBe('[{"type":"text","param":"third time lucky"}]');
    expect(reply.items).toEqual([{ type: 'text', param: 'third time lucky' }]);
  });
});
