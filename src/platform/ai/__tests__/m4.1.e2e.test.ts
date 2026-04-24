import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatWithCharacter,
} from '@/platform/userApp/sdk/ai';
import { useCharacterMemory } from '../characterMemoryStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import * as chatCompleteMod from '../chatComplete';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import { _resetCharacterAppStateForTests } from '../characterAppState';

beforeEach(() => {
  _resetCharacterAppStateForTests();
  useCharacterMemory.getState().clearAll();
  useCharacterStore.setState({
    characters: [{
      id: 'char-001',
      name: '小星',
      description: '', personality: '', scenario: '',
      systemPrompt: '', postHistoryInstructions: '', messageExamples: '',
    }] as never,
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
    summarizeThreshold: 0,
  } as never);
});

describe('M4.1 E2E — persistent vs clone across session lifetimes', () => {
  it('persistent=true: two sessions opened at different times share memory', async () => {
    // M4.2.5: mocks must return valid {type,param} JSON — the send path
    // now retries on parse errors.
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"text","param":"first reply"}]')
      .mockResolvedValueOnce('[{"type":"text","param":"second reply"}]');

    // First session — chat once
    await withUserAppContext('app-test', async () => {
      const s1 = chatWithCharacter('char-001', { persistent: true });
      await s1.send('hello');
    });

    // Simulate "app closed + reopened" — discard the old session, open a new one
    await withUserAppContext('app-test', async () => {
      const s2 = chatWithCharacter('char-001', { persistent: true });
      expect(s2.history).toEqual([]); // session buffer is fresh

      // memoryStore retains the previous exchange plus a leading
      // [上下文切换] marker from the first session's creation (null → app-test).
      // The second session is in the SAME app, so no additional marker fires.
      // Assistant entry stores the RENDERED form. After the renderer cleanup
      // the `<speaker>:` prefix no longer appears in the stored content —
      // transcript rendering owns that.
      const mem = useCharacterMemory.getState().getAll('char-001');
      expect(mem).toHaveLength(3);
      expect(mem[0]!.role).toBe('system');
      expect(mem[0]!.content).toMatch(/上下文切换/);
      expect(mem[0]!.content).toMatch(/app-test/);
      expect(mem[1]!.content).toBe('hello');
      expect(mem[2]!.content).toBe('first reply');

      // Next send layers on top; memoryStore ends with marker + all four turns.
      await s2.send('are you still there');
      const finalMem = useCharacterMemory.getState().getAll('char-001');
      expect(finalMem).toHaveLength(5);
      expect(finalMem.map((e) => e.content).slice(1)).toEqual([
        'hello', 'first reply', 'are you still there', 'second reply',
      ]);
    });
  });

  it('persistent=false: clone is isolated; memoryStore only sees the creation marker', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"clone reply"}]',
    );

    await withUserAppContext('app-test', async () => {
      const s1 = chatWithCharacter('char-001', { persistent: false });
      await s1.send('secret');
      expect(s1.history).toHaveLength(2);
    });

    // memoryStore receives ONLY the [上下文切换] marker from session creation —
    // the persistent=false session itself does not mirror user/assistant turns.
    const mem = useCharacterMemory.getState().getAll('char-001');
    expect(mem).toHaveLength(1);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);

    // A subsequent persistent=false session in the SAME app starts from a
    // fresh buffer; no additional marker fires (same lastActiveAppId).
    await withUserAppContext('app-test', async () => {
      const s2 = chatWithCharacter('char-001', { persistent: false });
      expect(s2.history).toEqual([]);
    });
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(1);
  });

  it('mixed: persistent=false side conversation does not leak into persistent=true', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"reply"}]',
    );

    await withUserAppContext('app-test', async () => {
      const clone = chatWithCharacter('char-001', { persistent: false });
      await clone.send('side topic');
    });

    await withUserAppContext('app-test', async () => {
      const real = chatWithCharacter('char-001', { persistent: true });
      await real.send('main topic');
    });

    const mem = useCharacterMemory.getState().getAll('char-001');
    // The clone's session-creation marker lands in memoryStore (scene state is
    // character-scoped, not session-scoped); the clone's user/assistant turns
    // do NOT leak. The subsequent persistent=true session in the same app does
    // not inject a second marker. The assistant entry is stored in its
    // RENDERED form — the {type:'text'} item renders as '小星: reply'.
    expect(mem.map((e) => e.content)).toEqual([
      '[上下文切换] 用户打开了 app-test',
      'main topic',
      'reply',
    ]);
  });
});
