import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runAIChat } from '../aiChatEngine';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
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
    useStickerStore.setState({ packs: [] } as never);
  });

  it('recovers readable text from malformed replies (plain prose)', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('plain text reply, no JSON wrapping')      // round 0: prose, recover as text
      .mockResolvedValueOnce('[{"type":"text","param":"reply 2"}]')      // round 1: valid
      .mockResolvedValueOnce('[{"type":"text","param":"reply 3"}]');     // round 2: valid

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 3,
      signal: ac.signal,
    });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.messages[0]!.text).toBe('hi');
    // Round 0's plain prose recovered
    expect(result.messages.some((m) => m.text === 'plain text reply, no JSON wrapping')).toBe(true);
    expect(result.messages.some((m) => m.text === 'reply 2')).toBe(true);
    expect(result.messages.some((m) => m.text === 'reply 3')).toBe(true);
  });

  it('extracts text params from broken JSON (unescaped Chinese quotes)', async () => {
    // This shape mimics the real failure: ASCII quotes around inner Chinese
    // text break JSON.parse, but the outer `"type":"text","param":"..."`
    // structure is intact enough for regex extraction.
    const broken = '[{"type":"text","param":"哈哈"开饭啦"了"},{"type":"text","param":"清楚"}]';
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce('[{"type":"text","param":"r2"}]');

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 2,
      signal: ac.signal,
    });

    // Recovered text from the broken first reply
    const recoveredText = result.messages.map((m) => m.text).join('|');
    // The regex should pick up at least the first "哈哈"开饭啦"了" param
    // (it captures up to the next quote that's part of the structure).
    // We're lenient about exact recovery — just verify SOMETHING from the
    // broken reply made it in, AND the chat continued to round 1.
    expect(recoveredText).toContain('哈哈');
    expect(result.messages.some((m) => m.text === 'r2')).toBe(true);
  });

  it('JSON-ish reply with no extractable text → silent skip (no raw JSON dump)', async () => {
    // Pure garbage that starts with `[` but has nothing matchable.
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"thought":"silent"},{"action":"none"}]')   // not text-typed
      .mockResolvedValueOnce('[{"type":"text","param":"r2"}]');

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 2,
      signal: ac.signal,
    });

    // No raw JSON in the messages
    expect(result.messages.every((m) => !m.text.startsWith('['))).toBe(true);
    // But round 1 (valid) still fires
    expect(result.messages.some((m) => m.text === 'r2')).toBe(true);
  });

  it('truly empty reply skips silently and loop continues', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('   ')                                        // empty
      .mockResolvedValueOnce('[{"type":"text","param":"r2"}]');

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 2,
      signal: ac.signal,
    });

    // Opening + round 1's reply, no placeholder for round 0
    expect(result.messages[0]!.text).toBe('hi');
    expect(result.messages.some((m) => m.text === 'r2')).toBe(true);
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

  it('renders sticker items as sticker Messages (not text bubbles with raw JSON)', async () => {
    // Seed a sticker the lookup can find
    useStickerStore.setState({
      packs: [{
        id: 'pack-1',
        name: 'test pack',
        stickers: [{ id: 's1', description: '开心', imageData: 'data:test/sticker' }],
      }],
    } as never);

    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce(
        '[{"type":"text","param":"哈哈"},{"type":"sticker","param":{"stickerId":"s1","content":"开心"}}]',
      )
      .mockResolvedValueOnce('[{"type":"text","param":"end"}]');

    const ac = new AbortController();
    const result = await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 2,
      signal: ac.signal,
    });

    // The text bubble exists
    expect(result.messages.some((m) => m.text === '哈哈')).toBe(true);
    // The sticker shows up via the [表情:开心] convention in generatedMessages
    expect(result.messages.some((m) => m.text === '[表情:开心]')).toBe(true);
    // Verify the actual xyData has a sticker-typed message
    const stickers = useXYData.getState().messages.filter((m) => m.type === 'sticker');
    expect(stickers.length).toBeGreaterThan(0);
    expect(stickers[0]!.stickerUrl).toBe('data:test/sticker');
  });

  it('passes XingYu Tool Registry context to assemblePrompt', async () => {
    // Use a spy on assemblePrompt to inspect what was passed
    const promptAssemblyMod = await import('../promptAssembly');
    const spy = vi.spyOn(promptAssemblyMod, 'assemblePrompt');
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"text","param":"x"}]');

    const ac = new AbortController();
    await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 1,
      signal: ac.signal,
    });

    expect(spy).toHaveBeenCalled();
    const input = spy.mock.calls[0]![0];
    // Confirms the XingYu app id was passed (not undefined)
    expect(input.currentAppId).toBe('xingyu');
    // Confirms availableTools is populated (text/sticker/update_signature)
    expect(input.availableTools?.map((t) => t.type).sort()).toEqual([
      'sticker', 'text', 'update_signature',
    ]);
    // Confirms appSystemPromptSnapshot is set (XingYu's "微信场景" prompt)
    expect(input.appSystemPromptSnapshot).toBeDefined();
    expect(typeof input.appSystemPromptSnapshot).toBe('string');
  });

  it('passes OpenRouter provider slug through to chatComplete', async () => {
    useAIConfigStore.setState({ openRouterProviderSlug: 'cerebras' } as never);
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"text","param":"x"}]');

    const ac = new AbortController();
    await runAIChat({
      initiatorCharId: A,
      targetCharId: B,
      openingMessage: 'hi',
      maxRounds: 1,
      signal: ac.signal,
    });

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]![0].openRouterProviderSlug).toBe('cerebras');
  });
});
