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

beforeEach(() => {
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
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('first reply')
      .mockResolvedValueOnce('second reply');

    // First session — chat once
    await withUserAppContext('app-test', async () => {
      const s1 = chatWithCharacter('char-001', { persistent: true });
      await s1.send('hello');
    });

    // Simulate "app closed + reopened" — discard the old session, open a new one
    await withUserAppContext('app-test', async () => {
      const s2 = chatWithCharacter('char-001', { persistent: true });
      expect(s2.history).toEqual([]); // session buffer is fresh

      // But memoryStore retains the previous exchange — visible via prompt replay
      const mem = useCharacterMemory.getState().getAll('char-001');
      expect(mem).toHaveLength(2);
      expect(mem[0]!.content).toBe('hello');
      expect(mem[1]!.content).toBe('first reply');

      // Next send layers on top; memoryStore ends with all four entries
      await s2.send('are you still there');
      const finalMem = useCharacterMemory.getState().getAll('char-001');
      expect(finalMem).toHaveLength(4);
      expect(finalMem.map((e) => e.content)).toEqual([
        'hello', 'first reply', 'are you still there', 'second reply',
      ]);
    });
  });

  it('persistent=false: clone is isolated and leaves memoryStore empty', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('clone reply');

    await withUserAppContext('app-test', async () => {
      const s1 = chatWithCharacter('char-001', { persistent: false });
      await s1.send('secret');
      expect(s1.history).toHaveLength(2);
    });

    // memoryStore completely untouched
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);

    // A subsequent persistent=false session starts from the same (empty) snapshot
    await withUserAppContext('app-test', async () => {
      const s2 = chatWithCharacter('char-001', { persistent: false });
      expect(s2.history).toEqual([]);
    });
  });

  it('mixed: persistent=false side conversation does not leak into persistent=true', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('reply');

    await withUserAppContext('app-test', async () => {
      const clone = chatWithCharacter('char-001', { persistent: false });
      await clone.send('side topic');
    });

    await withUserAppContext('app-test', async () => {
      const real = chatWithCharacter('char-001', { persistent: true });
      await real.send('main topic');
    });

    const mem = useCharacterMemory.getState().getAll('char-001');
    // Only the real exchange is persisted
    expect(mem.map((e) => e.content)).toEqual(['main topic', 'reply']);
  });
});
