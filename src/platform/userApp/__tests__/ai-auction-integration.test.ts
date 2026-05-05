// Integration test for the ai-auction-app fixture — drives the same surface
// (registerTools / registerReplyRenderer / registerAppSystemPrompt +
// chatWithCharacter + injectSystemEvent) that the fixture's App.tsx uses,
// but directly (no sandbox eval), so we can mock chatComplete and assert
// on the prompt / reply pipeline end-to-end.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatWithCharacter } from '@/platform/userApp/sdk/ai';
import {
  useCharacterMemory,
  _resetCharacterMemoryForTests,
} from '@/platform/ai/characterMemoryStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import {
  registerTools,
  registerReplyRenderer,
  registerAppSystemPrompt,
  injectSystemEvent,
} from '@/platform/userApp/sdk/ai';
import {
  _resetToolRegistryForTests,
  getTools,
} from '@/platform/ai/toolRegistry';
import {
  _resetReplyRendererRegistryForTests,
  getReplyRenderer,
} from '@/platform/ai/replyRendererRegistry';
import {
  _resetAppSystemPromptRegistryForTests,
  getAppSystemPrompt,
} from '@/platform/ai/appSystemPromptRegistry';
import { _resetCharacterAppStateForTests } from '@/platform/ai/characterAppState';
import * as chatCompleteMod from '@/platform/ai/chatComplete';

const APP_ID = 'ai-auction';

beforeEach(async () => {
  // Strip spyOn wrappers + mock.calls accumulated across tests so
  // spy.mock.calls[0] really means "the first call in THIS test".
  vi.restoreAllMocks();
  await _resetCharacterMemoryForTests();
  _resetToolRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetCharacterAppStateForTests();

  useCharacterStore.setState({
    characters: [{
      id: 'char-mc',
      name: '拍卖师',
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

  // Simulate the auction app mounting + doing its top-level registrations.
  // M4.2.5: include `text` in the knownTypes so parseReply accepts mixed
  // text+action replies. Matches the fixture App.tsx's 4-tool shape.
  withUserAppContext(APP_ID, () => {
    registerTools(APP_ID, [
      { type: 'text', description: '报幕', param: 'string' },
      { type: 'bid_call', description: '叫价', param: '{item: string, min: number}' },
      { type: 'accept_bid', description: '接受', param: '{bidder: string, amount: number}' },
      { type: 'hammer_down', description: '落槌', param: '{item: string, winner: string, final: number}' },
    ]);
    registerReplyRenderer(APP_ID, {
      render: (raw, ctx) => `${ctx.speakerName}|custom|${raw}`,
    });
    registerAppSystemPrompt(APP_ID, () => '你是拍卖师。拍品：#lot-1');
  });
});

describe('ai-auction integration', () => {
  it('prompt includes [当前任务] from appSystemPrompt + [可用动作] from toolRegistry', async () => {
    // Mock chatComplete to capture the prompt it was given
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');
    await withUserAppContext(APP_ID, async () => {
      const s = chatWithCharacter('char-mc', { persistent: true });
      await s.send('开始');
    });

    expect(spy).toHaveBeenCalled();
    const messages = spy.mock.calls[0]![1];
    const systemContent = messages.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes('[当前任务]'),
    )!.content as string;

    expect(systemContent).toContain('[当前任务]');
    expect(systemContent).toContain('你是拍卖师');
    expect(systemContent).toContain('[可用动作]');
    expect(systemContent).toContain('- bid_call:');
    expect(systemContent).toContain('- accept_bid:');
    expect(systemContent).toContain('- hammer_down:');
  });

  it('custom renderer runs on the assistant reply — rendered text matches registered format', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"拍品亮相"},{"type":"bid_call","param":{"item":"lot-1","min":500}}]',
    );
    const reply = await withUserAppContext(APP_ID, async () => {
      const s = chatWithCharacter('char-mc', { persistent: true });
      return s.send('开始');
    });

    // Custom renderer prefixes the speaker + "|custom|" + raw JSON
    expect(reply.rendered).toBe(
      '拍卖师|custom|[{"type":"text","param":"拍品亮相"},{"type":"bid_call","param":{"item":"lot-1","min":500}}]',
    );
    // reply.items now has both text and action items (no separate .actions field)
    const actions = reply.items.filter((i) => i.type !== 'text');
    expect(actions).toEqual([
      { type: 'bid_call', param: { item: 'lot-1', min: 500 } },
    ]);
  });

  it('injectSystemEvent pushes a system-role memory entry visible to the next prompt', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');

    // First session establishes context
    const s = await withUserAppContext(APP_ID, async () => {
      const session = chatWithCharacter('char-mc', { persistent: true });
      await session.send('hi');
      return session;
    });

    // Inject a mid-session event
    injectSystemEvent('char-mc', '[拍卖] #lot-1 流拍');

    // Confirm memory entry lands
    const mem = useCharacterMemory.getState().getAll('char-mc');
    const systemEntries = mem.filter((e) => e.role === 'system');
    const lastSystem = systemEntries[systemEntries.length - 1]!;
    expect(lastSystem.content).toBe('[拍卖] #lot-1 流拍');
    expect(lastSystem.source).toBe('system');

    // Next send — prompt contains the event. Re-spy and clear recorded
    // calls so `calls[0]` refers to the new send, not the earlier `hi`.
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('[]');
    spy.mockClear();
    await withUserAppContext(APP_ID, async () => s.send('继续'));

    const messages = spy.mock.calls[0]![1];
    const concatHistory = messages
      .filter((m) => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(concatHistory).toContain('[拍卖] #lot-1 流拍');
  });

  it('full bid → accept_bid → hammer_down cycle delivers three ChatReply items in order', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce(
        '[{"type":"bid_call","param":{"item":"lot-1","min":500}}]',
      )
      .mockResolvedValueOnce(
        '[{"type":"accept_bid","param":{"bidder":"A","amount":600}}]',
      )
      .mockResolvedValueOnce(
        '[{"type":"hammer_down","param":{"item":"lot-1","winner":"A","final":600}}]',
      );

    const s = await withUserAppContext(APP_ID, async () => {
      const session = chatWithCharacter('char-mc', { persistent: true });
      return session;
    });

    const r1 = await withUserAppContext(APP_ID, () => s.send('开拍'));
    expect(r1.items[0]!.type).toBe('bid_call');

    const r2 = await withUserAppContext(APP_ID, () => s.send('我出 600'));
    expect(r2.items[0]!.type).toBe('accept_bid');
    expect(r2.items[0]!.param).toEqual({ bidder: 'A', amount: 600 });

    const r3 = await withUserAppContext(APP_ID, () => s.send('一次二次'));
    expect(r3.items[0]!.type).toBe('hammer_down');
    expect((r3.items[0]!.param as { final: number }).final).toBe(600);
  });

  it('cleanup: registrations are queryable by appId', () => {
    expect(getTools(APP_ID).map((t) => t.type).sort()).toEqual([
      'accept_bid', 'bid_call', 'hammer_down', 'text',
    ]);
    const rend = getReplyRenderer(APP_ID);
    expect(rend.render('test', { speakerName: 'X', tools: [] })).toBe(
      'X|custom|test',
    );
    expect(getAppSystemPrompt(APP_ID)!()).toBe('你是拍卖师。拍品：#lot-1');
  });
});
