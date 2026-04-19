/**
 * M4.2 — Cross-app E2E. Walks XingYu → Auction → XingYu on the SAME
 * character, asserting the full ecology works together:
 *
 *   - chatWithCharacter auto-injects [上下文切换] markers at each app
 *     boundary (null → xingyu, xingyu → ai-auction, ai-auction → xingyu)
 *   - Each session's System block sees ONLY its own app's tools +
 *     appSystemPrompt (no leak across apps)
 *   - Memory (memoryStore entries) is shared across apps — the auction
 *     prompt sees the prior XingYu exchange as history
 *   - Assistant entries land as the RENDERED form (not raw JSON): XingYu
 *     via defaultXingYuRenderer, auction via its custom renderer
 *   - A persistent=false clone in XingYu leaves only its creation marker
 *     in memoryStore; its own user/assistant turns do NOT leak into a
 *     subsequent auction session
 *
 * See docs/plan/2026-04-19-2210-m4.2-s9-e2e-and-release-note.md Task 1
 */

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
import { defaultXingYuRenderer } from '../defaultXingYuRenderer';
import * as chatCompleteMod from '../chatComplete';

const XINGYU = 'xingyu';
const AUCTION = 'ai-auction';

beforeEach(async () => {
  // Strip spyOn wrappers accumulated across tests so `calls[0]` means
  // "first call in THIS test" rather than an older spy's cumulative log.
  vi.restoreAllMocks();
  await _resetCharacterMemoryForTests();
  _resetToolRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetCharacterAppStateForTests();

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
    summarizeThreshold: 0,
  } as never);

  // XingYu's AI surface
  registerTools(XINGYU, [
    { name: 'sticker', description: '表情', parameters: { stickerId: 'string', content: 'string' } },
    { name: 'update_signature', description: '签名', parameters: { text: 'string' } },
  ]);
  registerReplyRenderer(XINGYU, defaultXingYuRenderer);
  registerAppSystemPrompt(XINGYU, () => '当前可用表情：\ns1: 笑脸\ns2: 哭脸');

  // Auction's AI surface
  registerTools(AUCTION, [
    { name: 'bid_call', description: '叫价', parameters: { item: 'string', min: 'number' } },
    { name: 'hammer_down', description: '落槌', parameters: { item: 'string', winner: 'string', final: 'number' } },
  ]);
  registerReplyRenderer(AUCTION, {
    render: (raw, ctx) => `${ctx.speakerName}|AUC|${raw}`,
  });
  registerAppSystemPrompt(AUCTION, () => '你是一场拍卖会主持人。');
});

describe('M4.2 E2E — cross-app on the same character', () => {
  it('XingYu → Auction → XingYu: each session sees only its own tools; switches fire markers; memories are shared', async () => {
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete');

    // ── Round 1: XingYu conv ────────────────────────────────────
    chatSpy.mockResolvedValueOnce(
      '[{"type":"text","content":"你好呀"},{"type":"action","name":"sticker","params":{"stickerId":"s1","content":"笑脸"}}]',
    );
    await withUserAppContext(XINGYU, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      const reply = await s.send('早上好');
      expect(reply.actions[0]!.name).toBe('sticker');
    });

    const mem1 = useCharacterMemory.getState().getAll('char-001');
    // [0] switch marker: '[上下文切换] 用户打开了 xingyu'
    // [1] user: '早上好' (stored plain — persona prefix added at render)
    // [2] assistant rendered: text + action via defaultXingYuRenderer
    expect(mem1).toHaveLength(3);
    expect(mem1[0]!.role).toBe('system');
    expect(mem1[0]!.content).toMatch(/上下文切换/);
    expect(mem1[0]!.content).toMatch(/xingyu/);
    expect(mem1[1]!).toMatchObject({ role: 'user', content: '早上好' });
    expect(mem1[2]!.role).toBe('assistant');
    expect(mem1[2]!.content).toBe(
      '小星: 你好呀\n小星: 【sticker】stickerId=s1 content=笑脸',
    );

    // Confirm the XingYu prompt contained sticker tools and the stickers
    // appSystemPrompt, NOT auction tools.
    const xingyuMessages = chatSpy.mock.calls[0]![1];
    const xingyuSys = xingyuMessages.find((m) => m.role === 'system')!.content as string;
    expect(xingyuSys).toContain('- sticker:');
    expect(xingyuSys).toContain('- update_signature:');
    expect(xingyuSys).not.toContain('- bid_call:');
    expect(xingyuSys).not.toContain('- hammer_down:');
    expect(xingyuSys).toContain('s1: 笑脸');

    // ── Round 2: switch to Auction app ───────────────────────────
    chatSpy.mockResolvedValueOnce(
      '[{"type":"action","name":"bid_call","params":{"item":"lot-1","min":500}}]',
    );
    await withUserAppContext(AUCTION, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      const reply = await s.send('开拍吧');
      expect(reply.actions[0]!.name).toBe('bid_call');
    });

    const mem2 = useCharacterMemory.getState().getAll('char-001');
    // Added: [3] switch marker '从 xingyu 切到了 ai-auction',
    //        [4] user '开拍吧', [5] assistant (custom renderer).
    expect(mem2).toHaveLength(6);
    expect(mem2[3]!.role).toBe('system');
    expect(mem2[3]!.content).toMatch(/从 xingyu 切到了 ai-auction/);
    expect(mem2[4]!).toMatchObject({ role: 'user', content: '开拍吧' });
    expect(mem2[5]!.role).toBe('assistant');
    // Auction renderer output = `<speaker>|AUC|<raw>`
    expect(mem2[5]!.content).toBe(
      '小星|AUC|[{"type":"action","name":"bid_call","params":{"item":"lot-1","min":500}}]',
    );

    // Auction prompt MUST NOT contain XingYu tools.
    const auctionMessages = chatSpy.mock.calls[1]![1];
    const auctionSys = auctionMessages.find((m) => m.role === 'system')!.content as string;
    expect(auctionSys).toContain('- bid_call:');
    expect(auctionSys).toContain('- hammer_down:');
    expect(auctionSys).not.toContain('- sticker:');
    expect(auctionSys).not.toContain('- update_signature:');
    expect(auctionSys).toContain('你是一场拍卖会主持人');

    // History carried across — auction prompt sees the XingYu exchange.
    const auctionNonSystem = auctionMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(auctionNonSystem).toContain('小米：早上好'); // user turn w/ persona prefix
    expect(auctionNonSystem).toContain('你好呀');      // assistant from prev round

    // ── Round 3: back to XingYu ─────────────────────────────────
    chatSpy.mockResolvedValueOnce('[{"type":"text","content":"拍卖结束了?"}]');
    await withUserAppContext(XINGYU, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('聊聊刚刚的拍卖');
    });

    const mem3 = useCharacterMemory.getState().getAll('char-001');
    // Added: [6] switch marker '从 ai-auction 切到了 xingyu',
    //        [7] user, [8] assistant.
    expect(mem3).toHaveLength(9);
    expect(mem3[6]!.content).toMatch(/从 ai-auction 切到了 xingyu/);

    // Final XingYu prompt has XingYu tools (not auction tools) again.
    const finalMessages = chatSpy.mock.calls[2]![1];
    const finalSys = finalMessages.find((m) => m.role === 'system')!.content as string;
    expect(finalSys).toContain('- sticker:');
    expect(finalSys).not.toContain('- bid_call:');
  });

  it('getTools across apps is scoped — XingYu tools and Auction tools do not leak into each other', () => {
    const xTools = getTools(XINGYU).map((t) => t.name).sort();
    const aTools = getTools(AUCTION).map((t) => t.name).sort();
    expect(xTools).toEqual(['sticker', 'update_signature']);
    expect(aTools).toEqual(['bid_call', 'hammer_down']);
  });

  it('a session created inside XingYu with persistent=false does NOT leak its turns into the auction session that follows', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","content":"secret"}]',
    );

    // XingYu clone session (persistent=false)
    await withUserAppContext(XINGYU, async () => {
      const clone = chatWithCharacter('char-001', { persistent: false });
      await clone.send('私密话');
    });

    // memoryStore only has the XingYu-enter marker — S2 markers fire on
    // the character-scoped scene state regardless of persistent flag, but
    // persistent=false suppresses the session's own user/assistant mirror.
    const memAfterClone = useCharacterMemory.getState().getAll('char-001');
    expect(memAfterClone).toHaveLength(1);
    expect(memAfterClone[0]!.role).toBe('system');
    expect(memAfterClone[0]!.content).toMatch(/上下文切换/);

    // Auction session — sees the XingYu→auction marker but NOT the clone turns.
    const chatSpy = vi
      .spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValue('[{"type":"text","content":"ok"}]');
    chatSpy.mockClear();
    await withUserAppContext(AUCTION, async () => {
      const s = chatWithCharacter('char-001', { persistent: true });
      await s.send('开拍');
    });

    const auctionMessages = chatSpy.mock.calls[chatSpy.mock.calls.length - 1]![1];
    const auctionBody = auctionMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(auctionBody).not.toContain('私密话'); // clone's user turn not leaked
    expect(auctionBody).toContain('开拍');        // current session's user turn present
  });
});
