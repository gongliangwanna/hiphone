import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useCharacterMemory, _resetCharacterMemoryForTests } from '@/platform/ai/characterMemoryStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import * as chatCompleteMod from '@/platform/ai/chatComplete';
import { _resetCharacterAppStateForTests } from '@/platform/ai/characterAppState';

beforeEach(async () => {
  // Let any in-flight xingYuDataStore rehydrate settle before we wipe
  // state — otherwise its async loadCharacterMemoryFromIdb could race
  // our reset and clear our test setup mid-flight.
  await new Promise((r) => setTimeout(r, 20));
  // S7: scheduleAICharacterReply wraps chatWithCharacter in
  // withUserAppContext('xingyu'), so the [上下文切换] marker is injected
  // the first time any character starts a session under 'xingyu'. Reset
  // the per-character app state so tests see a fresh first-contact marker.
  _resetCharacterAppStateForTests();
  await _resetCharacterMemoryForTests();
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
  useXYData.setState({
    conversations: [{
      id: 'c-char-char-001',
      idolId: 'char-001',
      characterId: 'char-001',
      lastMsg: '', lastTime: 0, unread: 0,
    }],
    messages: [],
    moments: [],
    interactions: [],
    favorites: [],
  } as never);
});

describe('XingYu sendMessage flow — memoryStore integration', () => {
  it('user send + AI reply → memoryStore has app-switch marker + user entry + ONE rendered assistant entry', async () => {
    const rawJson = '[{"type":"text","param":"挺不错的呀"},{"type":"text","param":"阳光明媚"}]';
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(rawJson);

    useXYData.getState().sendMessage('c-char-char-001', '今天天气怎么样');

    console.log('[t=0 after send]', useCharacterMemory.getState().getAll('char-001').length);
    await new Promise((r) => setTimeout(r, 100));
    console.log('[t=100ms]', useCharacterMemory.getState().getAll('char-001').length);
    await new Promise((r) => setTimeout(r, 400));
    console.log('[t=500ms]', useCharacterMemory.getState().getAll('char-001').length);
    await new Promise((r) => setTimeout(r, 1000));
    console.log('[t=1500ms]', useCharacterMemory.getState().getAll('char-001').length);
    await new Promise((r) => setTimeout(r, 1000));
    const mem = useCharacterMemory.getState().getAll('char-001');
    // Order: [marker, user, assistant] — XingYu's sendMessage now calls
    // fireAppSwitchMarker BEFORE _appendMessage so the [上下文切换] system
    // event lands ahead of the first user turn in the transcript (bug fix
    // for the session creator racing the user entry). Assistant entry is
    // the RENDERED form (spec D1), which after the renderer cleanup no
    // longer carries a speaker prefix — transcript rendering owns that.
    expect(mem).toHaveLength(3);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!).toMatchObject({
      role: 'user',
      speakerId: 'me',
      content: '今天天气怎么样',
      source: 'xingyu',
    });
    expect(mem[2]!).toMatchObject({
      role: 'assistant',
      speakerId: 'char-001',
      content: '挺不错的呀\n阳光明媚', // ← rendered form, no speaker prefix
      source: 'xingyu',
    });

    // xingYuDataStore UI side: user text + 2 bubble AI messages (no placeholder left)
    // Note: codebase convention is senderId = `char-${characterId}` where
    // characterId already starts with 'char-', giving 'char-char-001'.
    const msgs = useXYData.getState().messages.filter((m) => !m.streaming);
    expect(msgs.filter((m) => m.type === 'text' && m.senderId === 'me').map((m) => m.type === 'text' && m.text)).toEqual(['今天天气怎么样']);
    expect(msgs.filter((m) => m.senderId === 'char-char-001')).toHaveLength(2);
  }, 10_000);

  it('AI failure → error placeholder lands in xingYuDataStore but NOT memoryStore', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockRejectedValue(new Error('rate limit'));

    useXYData.getState().sendMessage('c-char-char-001', '你好');

    await new Promise((r) => setTimeout(r, 100));

    const mem = useCharacterMemory.getState().getAll('char-001');
    // [上下文切换] marker (written by fireAppSwitchMarker pre-user) + user
    // entry. No assistant entry — XingYu's catch path does not append on
    // failure, and the [AI 回复失败] UI bubble isn't routed through
    // memoryStore either.
    expect(mem).toHaveLength(2);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!.role).toBe('user');

    const xyMsgs = useXYData.getState().messages.filter((m) => !m.streaming);
    const errMsg = xyMsgs.find((m) => m.type === 'text' && m.text.startsWith('[AI 回复失败]'));
    expect(errMsg).toBeDefined();
  });

  it('sendImageMessage → memoryStore has "[图片 <url>]" user entry', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"好可爱"}]',
    );

    useXYData.getState().sendImageMessage(
      'c-char-char-001',
      'https://example.com/cat.jpg',
    );

    await new Promise((r) => setTimeout(r, 2500));

    const mem = useCharacterMemory.getState().getAll('char-001');
    // Order: marker + user + rendered assistant (marker lands first now).
    expect(mem).toHaveLength(3);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!).toMatchObject({
      role: 'user',
      speakerId: 'me',
      content: '[图片 https://example.com/cat.jpg]',
    });
    expect(mem[2]!).toMatchObject({
      role: 'assistant',
      content: '好可爱',
    });
  }, 10_000);

  it('sendStickerMessage → memoryStore has "[表情：desc]" user entry', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"哈哈"}]',
    );

    useXYData.getState().sendStickerMessage(
      'c-char-char-001',
      'data:image/png;base64,xxx',
      '笑脸',
    );

    await new Promise((r) => setTimeout(r, 2500));

    const mem = useCharacterMemory.getState().getAll('char-001');
    // Order: marker + user + rendered assistant.
    expect(mem).toHaveLength(3);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/上下文切换/);
    expect(mem[1]!.content).toBe('[表情：笑脸]');
    expect(mem[2]!).toMatchObject({
      role: 'assistant',
      content: '哈哈',
    });
  }, 10_000);

  it('AI parse exhaustion → [AI 回复失败] bubble lands in UI, no toast', async () => {
    const toastMod = await import('@/platform/userApp/sdk/toast');
    const toastSpy = vi.spyOn(toastMod, 'show').mockImplementation(() => {});

    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('total garbage');

    useXYData.getState().sendMessage('c-char-char-001', '你好');

    await new Promise((r) => setTimeout(r, 500));

    const msgs = useXYData.getState().messages.filter((m) => !m.streaming);
    const errMsg = msgs.find(
      (m) => m.type === 'text' && m.text.startsWith('[AI 回复失败]'),
    );
    expect(errMsg).toBeDefined();

    // Platform toast must NOT fire — XingYu suppressed it via onParseFailure
    expect(toastSpy).not.toHaveBeenCalled();
  }, 10_000);
});
