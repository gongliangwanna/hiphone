// src/platform/ai/__tests__/m4.2.5.e2e.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatWithCharacter } from '@/platform/userApp/sdk/ai';
import {
  useCharacterMemory,
  _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import {
  registerTools,
  registerReplyRenderer,
  registerAppSystemPrompt,
} from '@/platform/userApp/sdk/ai';
import {
  _resetToolRegistryForTests,
  getTools,
} from '../toolRegistry';
import { _resetReplyRendererRegistryForTests } from '../replyRendererRegistry';
import { _resetAppSystemPromptRegistryForTests } from '../appSystemPromptRegistry';
import { _resetCharacterAppStateForTests } from '../characterAppState';
import { defaultReplyRenderer } from '../defaultReplyRenderer';
import * as chatCompleteMod from '../chatComplete';
import * as toastMod from '@/platform/userApp/sdk/toast';

const XINGYU = 'xingyu';
const AUCTION = 'ai-auction';

function findSystemContent(
  messages: readonly { role: string; content: unknown }[],
  marker: string,
): string {
  const found = messages.find(
    (m) =>
      m.role === 'system' &&
      typeof m.content === 'string' &&
      m.content.includes(marker),
  );
  if (!found || typeof found.content !== 'string') {
    throw new Error(`missing system content: ${marker}`);
  }
  return found.content;
}

beforeEach(async () => {
  await _resetCharacterMemoryForTests();
  _resetToolRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetCharacterAppStateForTests();
  vi.restoreAllMocks();

  // Character (shared across both apps)
  useCharacterStore.setState({
    characters: [{
      id: 'char-001',
      name: '小星',
      description: '',
      personality: '',
      scenario: '',
      systemPrompt: '',
      postHistoryInstructions: '',
      messageExamples: '',
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
  } as never);

  // XingYu — 3 tools (text, sticker, update_signature), default renderer
  registerTools(XINGYU, [
    { type: 'text', description: '发消息', param: 'string' },
    { type: 'sticker', description: '发表情', param: '{stickerId: string, content: string}' },
    { type: 'update_signature', description: '改签名', param: '{text: string}' },
  ]);
  registerReplyRenderer(XINGYU, defaultReplyRenderer);
  registerAppSystemPrompt(XINGYU, () => '当前可用表情:\ns1: 笑脸');

  // Auction — 4 tools (text + 3 actions), custom renderer
  registerTools(AUCTION, [
    { type: 'text', description: '报幕', param: 'string' },
    { type: 'bid_call', description: '叫价', param: '{item: string, min: number}' },
    { type: 'accept_bid', description: '接受', param: '{bidder: string, amount: number}' },
    { type: 'hammer_down', description: '落槌', param: '{item: string, winner: string, final: number}' },
  ]);
  registerReplyRenderer(AUCTION, {
    render: (raw, ctx) => `${ctx.speakerName}|AUC|${raw}`,
  });
  registerAppSystemPrompt(AUCTION, () => '你是拍卖会主持人。');
});

describe('M4.2.5 E2E — unified {type, param} across apps', () => {
  it('XingYu → Auction → XingYu: tools scoped per app, memory shared, switch markers fire', async () => {
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete');

    // ── Round 1: XingYu conv
    chatSpy.mockResolvedValueOnce(
      '[{"type":"text","param":"你好呀"},{"type":"sticker","param":{"stickerId":"s1","content":"笑脸"}}]',
    );
    await withUserAppContext(XINGYU, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      const reply = await s.send('早上好');
      expect(reply.items).toEqual([
        { type: 'text', param: '你好呀' },
        { type: 'sticker', param: { stickerId: 's1', content: '笑脸' } },
      ]);
    });

    const mem1 = useCharacterMemory.getState().getAll('char-001');
    // [0] switch marker '打开 xingyu'
    // [1] user '早上好'
    // [2] assistant rendered
    expect(mem1).toHaveLength(3);
    expect(mem1[0]!.role).toBe('system');
    expect(mem1[0]!.content).toMatch(/上下文切换/);
    expect(mem1[0]!.content).toMatch(/xingyu/);
    expect(mem1[1]!).toMatchObject({ role: 'user', content: '早上好' });
    // Default renderer output: plain text for text items; sticker renders as
    // `发了一个"<content>"的表情包` (stickerId hidden from history to prevent
    // LLM hallucination). The transcript layer owns the `[HH:MM] speaker：`
    // prefix, not the renderer.
    expect(mem1[2]!.role).toBe('assistant');
    expect(mem1[2]!.content).toBe(
      '你好呀\n发了一个"笑脸"的表情包',
    );

    // Confirm XingYu prompt had ONLY XingYu's tools in chunk 8
    const xingyuMessages = chatSpy.mock.calls[0]![1];
    const xingyuSys = findSystemContent(xingyuMessages, '[可用动作]');
    expect(xingyuSys).toContain('- text:');
    expect(xingyuSys).toContain('- sticker:');
    expect(xingyuSys).toContain('- update_signature:');
    expect(xingyuSys).not.toContain('- bid_call:');
    expect(xingyuSys).not.toContain('- hammer_down:');

    // ── Round 2: switch to Auction
    chatSpy.mockResolvedValueOnce(
      '[{"type":"text","param":"开拍了"},{"type":"bid_call","param":{"item":"lot-1","min":500}}]',
    );
    await withUserAppContext(AUCTION, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      const reply = await s.send('开始');
      expect(reply.items).toEqual([
        { type: 'text', param: '开拍了' },
        { type: 'bid_call', param: { item: 'lot-1', min: 500 } },
      ]);
    });

    const mem2 = useCharacterMemory.getState().getAll('char-001');
    // Added: [3] switch marker, [4] user '开始', [5] assistant rendered by custom renderer
    expect(mem2).toHaveLength(6);
    expect(mem2[3]!.role).toBe('system');
    expect(mem2[3]!.content).toMatch(/从 xingyu 切到了 ai-auction/);
    expect(mem2[4]!).toMatchObject({ role: 'user', content: '开始' });
    expect(mem2[5]!.role).toBe('assistant');
    // Auction's custom renderer: "<speaker>|AUC|<raw>"
    expect(mem2[5]!.content).toBe(
      '小星|AUC|[{"type":"text","param":"开拍了"},{"type":"bid_call","param":{"item":"lot-1","min":500}}]',
    );

    // Auction prompt must NOT contain XingYu tools
    const auctionMessages = chatSpy.mock.calls[1]![1];
    const auctionSys = findSystemContent(auctionMessages, '[可用动作]');
    expect(auctionSys).toContain('- bid_call:');
    expect(auctionSys).toContain('- hammer_down:');
    expect(auctionSys).not.toContain('- sticker:');
    expect(auctionSys).not.toContain('- update_signature:');

    // History carried across: Auction prompt should include XingYu's earlier exchange.
    // The new layout puts mid-history entries inside a single [历史记录] system block,
    // and the last user entry of this round ("开始") becomes the trailing user turn.
    const auctionTranscript = auctionMessages.find(
      (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('[历史记录]'),
    );
    expect(auctionTranscript?.content).toContain('小米：早上好');
    expect(auctionTranscript?.content).toContain('你好呀');

    // ── Round 3: back to XingYu
    chatSpy.mockResolvedValueOnce('[{"type":"text","param":"聊聊刚刚的拍卖吧"}]');
    await withUserAppContext(XINGYU, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('回 XingYu');
    });

    const mem3 = useCharacterMemory.getState().getAll('char-001');
    // Added: [6] switch marker, [7] user, [8] assistant
    expect(mem3).toHaveLength(9);
    expect(mem3[6]!.content).toMatch(/从 ai-auction 切到了 xingyu/);

    // Final XingYu prompt re-scopes to XingYu tools
    const finalMessages = chatSpy.mock.calls[2]![1];
    const finalSys = findSystemContent(finalMessages, '[可用动作]');
    expect(finalSys).toContain('- sticker:');
    expect(finalSys).not.toContain('- bid_call:');
  });

  it('getTools scopes per-app — XingYu and Auction tool lists do not leak', () => {
    const xTypes = getTools(XINGYU).map((t) => t.type).sort();
    const aTypes = getTools(AUCTION).map((t) => t.type).sort();
    expect(xTypes).toEqual(['sticker', 'text', 'update_signature']);
    expect(aTypes).toEqual(['accept_bid', 'bid_call', 'hammer_down', 'text']);
  });

  it('persistent=false clone does not leak its turns into the next app session', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"private"}]',
    );

    // XingYu clone
    await withUserAppContext(XINGYU, async () => {
      const clone = chatWithCharacter('char-001', { persistent: false });
      await clone.send('私密话');
    });

    const memAfterClone = useCharacterMemory.getState().getAll('char-001');
    // Only the [上下文切换] marker; no user/assistant turns (persistent:false)
    expect(memAfterClone).toHaveLength(1);
    expect(memAfterClone[0]!.role).toBe('system');

    // Auction session — sees the marker but not the clone content
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"ok"}]',
    );
    await withUserAppContext(AUCTION, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('开拍');
    });

    const auctionMessages = chatSpy.mock.calls[chatSpy.mock.calls.length - 1]![1];
    const auctionBody = auctionMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(auctionBody).not.toContain('私密话'); // clone's content not leaked
    expect(auctionBody).toContain('开拍');
  });

  it('parse error retry loop works in a real-apps scenario (XingYu with 2 bad + 1 good)', async () => {
    const toastSpy = vi.spyOn(toastMod, 'show').mockImplementation(() => {});
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('not valid json at all')  // not-json
      .mockResolvedValueOnce('[{"type":"unknown_tool","param":{}}]')  // unknown-type
      .mockResolvedValueOnce('[{"type":"text","param":"sorry, recovered"}]'); // good

    const reply = await withUserAppContext(XINGYU, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('hi');
    });

    expect(reply.items).toEqual([{ type: 'text', param: 'sorry, recovered' }]);
    expect(toastSpy).not.toHaveBeenCalled(); // succeeded on 3rd, no toast

    // M4.x bugfix: parse-error retries no longer pollute long-term memory.
    // Failure raws + correction notices are transient (retryNudges) — only
    // the user input + the FINAL successful rendered reply are persisted.
    const mem = useCharacterMemory.getState().getAll('char-001');
    // [0] switch marker, [1] user 'hi', [2] final assistant 'sorry, recovered'
    expect(mem).toHaveLength(3);
    expect(mem[1]!.role).toBe('user');
    expect(mem[1]!.content).toBe('hi');
    expect(mem[2]!.role).toBe('assistant');
    expect(mem[2]!.content).toBe('sorry, recovered');
    // No bad raws, no parse-error system entries, no exhaustion summary.
    expect(mem.find((e) => e.content === 'not valid json at all')).toBeUndefined();
    expect(
      mem.find((e) => e.role === 'system' && e.content.includes('[格式错误]')),
    ).toBeUndefined();
  });

  it('parse exhaustion in Auction → platform toast fires (no onParseFailure set)', async () => {
    const toastSpy = vi.spyOn(toastMod, 'show').mockImplementation(() => {});
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('garbage');

    const reply = await withUserAppContext(AUCTION, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      return s.send('开拍');
    });

    expect(reply.items).toEqual([]);
    expect(reply.rendered).toBe('[生成失败]');
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith('AI 回复格式错误');

    // M4.x bugfix: exhaustion no longer commits failure raws or the
    // "已放弃重试" summary to memory. Only the user input + auto switch
    // marker remain — the toast surfaces failure UX without polluting the
    // chat thread.
    const mem = useCharacterMemory.getState().getAll('char-001');
    // [0] switch marker, [1] user '开拍'
    expect(mem).toHaveLength(2);
    expect(mem[1]!.role).toBe('user');
    expect(mem[1]!.content).toBe('开拍');
    expect(mem.find((e) => e.content === 'garbage')).toBeUndefined();
    expect(mem.find((e) => e.content.includes('已放弃重试'))).toBeUndefined();
    expect(
      mem.find((e) => e.role === 'system' && e.content.includes('[格式错误]')),
    ).toBeUndefined();
  });
});
