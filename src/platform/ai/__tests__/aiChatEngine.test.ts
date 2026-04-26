import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runAIChat } from '../aiChatEngine';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { _resetCharacterMemoryForTests } from '../characterMemoryStore';
import * as chatCompleteMod from '../chatComplete';

const A = 'char-a';
const B = 'char-b';

describe('runAIChat — multi-round resilience', () => {
  beforeEach(async () => {
    // restoreAllMocks (not clearAllMocks) — the latter keeps leftover
    // mockResolvedValueOnce queues, which would bleed into the next test
    // when an earlier test consumed fewer mocks than it queued.
    vi.restoreAllMocks();
    await _resetCharacterMemoryForTests();
    useCharacterStore.setState({
      characters: [
        { id: A, name: '小A', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
        { id: B, name: '小B', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
    useAIConfigStore.setState({
      apiKey: 'test',
      provider: 'openrouter',
      apiEndpoint: 'https://api.test',
      model: 'gpt-test',
      contextWindow: 8000,
      maxTokens: 1000,
      keepRecentMessages: 10,
      summarizeThreshold: 0.8,
      worldInfoBudgetPercent: 0.3,
      enableVision: false,
      systemPrompt: '',
      postHistoryInstructions: '',
      temperature: 0.8,
    } as never);
    usePersonaStore.setState({
      personas: [{ id: 'p', name: 'P', description: '', avatar: '', isDefault: false }],
      activePersonaId: 'p',
    } as never);
    useXYData.setState({
      conversations: [], messages: [], moments: [], characterSignatures: {},
      userSignatureHistory: [], interactions: [], unreadInteractionCount: 0,
      characterLastReadMsgTs: {}, characterSeenInteractionCount: {},
      favorites: [],
      userSettings: { nickname: 'P', bio: '', accentColor: '#000', avatarUrl: '', coverUrl: '' },
    } as never);
  });

  it('continues past a malformed reply by falling back to raw text', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('plain text reply, no JSON wrapping')      // round 1: malformed
      .mockResolvedValueOnce('[{"type":"text","param":"reply 2"}]')      // round 2: valid
      .mockResolvedValueOnce('[{"type":"text","param":"reply 3"}]');     // round 3: valid

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 3,
      signal: ac.signal,
    });

    // 1 opening + 3 replies = 4 messages
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]!.text).toBe('hi');
    // round 1 fell back to raw text
    expect(result.messages[1]!.text).toContain('plain text reply');
    expect(result.messages[2]!.text).toBe('reply 2');
    expect(result.messages[3]!.text).toBe('reply 3');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('breaks only when the raw reply is truly empty', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"text","param":"reply 1"}]')      // valid
      .mockResolvedValueOnce('   ')                                       // truly empty after trim
      .mockResolvedValueOnce('[{"type":"text","param":"reply 3"}]');     // would be valid but never reached

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 3,
      signal: ac.signal,
    });

    // Opening + 1 reply, then break on empty
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]!.text).toBe('reply 1');
  });

  it('signature-only reply does not abort the conversation', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"update_signature","param":{"text":"new sig"}}]')  // signature only — no text items
      .mockResolvedValueOnce('[{"type":"text","param":"second"}]');

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 2,
      signal: ac.signal,
    });

    // Both chatComplete calls fired → loop ran to completion (no early abort
    // on the signature-only round). This is the regression we care about:
    // pre-fix, the loop would break after round 0 because textParts was empty.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.messages[0]!.text).toBe('hi');
    expect(result.messages.some((m) => m.text === 'second')).toBe(true);
  });
});
