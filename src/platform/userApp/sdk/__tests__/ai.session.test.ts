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

beforeEach(() => {
  _resetCharacterAppStateForTests();
  _resetToolRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
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
    // mem[0] is the session-creation [上下文切换] marker, then user + reply.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(3);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!).toMatchObject({ role: 'user', speakerId: 'me', content: 'hello', source: 'app:app-demo' });
    expect(mem[2]!).toMatchObject({ role: 'assistant', speakerId: 'char-001', content: 'reply B', source: 'app:app-demo' });
  });

  it('persistent=true + mirror:false: buffer updated, memoryStore gets only the creation marker', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply C');
    const s = withUserAppContext('app-demo', () =>
      chatWithCharacter('char-001', { persistent: true }),
    );
    const reply = await withUserAppContext('app-demo', () => s.send('hello', { mirror: false }));

    expect(reply).toBe('reply C');
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
      { name: 'bid_call', description: '叫价', parameters: { min: 'number' } },
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
      { name: 'bid_call', description: '叫价', parameters: { min: 'number' } },
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
