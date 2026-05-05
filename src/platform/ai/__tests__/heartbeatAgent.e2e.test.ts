import { describe, it, expect, beforeEach, vi } from 'vitest';
import { triggerHeartbeat } from '../heartbeatAgent';
import {
  registerHeartbeatAi,
  _resetHeartbeatRegistrationForTests,
} from '../heartbeatRegister';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import {
  useCharacterMemory,
  _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { _resetToolRegistryForTests } from '../toolRegistry';
import { _resetAppSystemPromptRegistryForTests } from '../appSystemPromptRegistry';
import { resetHeartbeatLimits } from '../heartbeatTools';
import * as chatCompleteMod from '../chatComplete';

const CHAR = 'char-e2e';

describe('heartbeatAgent — end-to-end via Tool Registry', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _resetToolRegistryForTests();
    _resetAppSystemPromptRegistryForTests();
    _resetHeartbeatRegistrationForTests();
    await _resetCharacterMemoryForTests();
    resetHeartbeatLimits(CHAR);

    useCharacterStore.setState({
      characters: [
        { id: CHAR, name: '测试角色', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
    useAIConfigStore.setState({
      apiKey: 'test-key',
      provider: 'openrouter',
      apiEndpoint: 'https://api.test',
      model: 'gpt-test',
      temperature: 0.8,
      contextWindow: 8000,
      maxTokens: 1000,
      keepRecentMessages: 10,
      summarizeThreshold: 0.8,
      worldInfoBudgetPercent: 0.3,
      enableVision: false,
      systemPrompt: '',
      postHistoryInstructions: '',
    } as never);
    usePersonaStore.setState({
      personas: [{ id: 'p', name: '玩家', description: '', avatar: '', isDefault: false }],
      activePersonaId: 'p',
    } as never);
    useHeartbeatStore.setState({
      globalEnabled: true,
      configs: {
        [CHAR]: {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 5,
          aiChatMaxRounds: 3,
          virtualWorldStoryEnabled: false,
        },
      },
      lastHeartbeat: {},
      runningCharacters: {},
      recentLog: [],
    } as never);
    useXYData.setState({
      conversations: [], messages: [], moments: [], characterSignatures: {},
      userSignatureHistory: [], interactions: [], unreadInteractionCount: 0,
      characterLastReadMsgTs: {}, characterSeenInteractionCount: {},
      favorites: [],
      userSettings: { nickname: '玩家', bio: '', accentColor: '#000', avatarUrl: '', coverUrl: '' },
    } as never);

    registerHeartbeatAi();
  });

  it('runs a full ReAct loop with {type, param} protocol + done', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"view_user_signature","param":{}}]')
      .mockResolvedValueOnce('[{"type":"send_message","param":{"text":"嗨"}}]')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(3);
    // send_message wrote a proactive bubble into xingYuDataStore
    const msgs = useXYData.getState().messages;
    const proactive = msgs.find((m) => m.type === 'text' && m.text === '嗨');
    expect(proactive).toBeDefined();

    const log = msgs.find((m) => m.type === 'heartbeat_log');
    expect(log?.text).toContain('[自主活动开始]');
    expect(log?.text).toContain('我查看了用户的个性签名');

    const memoryText = useCharacterMemory
      .getState()
      .getAll(CHAR)
      .map((m) => m.content)
      .join('\n');
    expect(memoryText).toContain('[自主活动记录]');
    expect(memoryText).toContain('我查看了用户的个性签名');
  });

  it('observations come back as role:user messages to the LLM (Anthropic compat)', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete');
    spy
      .mockResolvedValueOnce('[{"type":"view_user_signature","param":{}}]')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    // The second chatComplete call received messages INCLUDING the
    // observation from the first tool. Inspect the second call's args.
    const secondCallArgs = spy.mock.calls[1]!;
    const messagesSentToLLM = secondCallArgs[1];
    const observationMsg = messagesSentToLLM.find(
      (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('Observation:'),
    );
    expect(observationMsg).toBeDefined();
  });

  it('parse error → role:user correction fed back, loop continues', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('total garbage')                 // parse fail
      .mockResolvedValueOnce('[{"type":"done","param":{}}]'); // recovers

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(2);
    const secondCallMessages = spy.mock.calls[1]![1];
    const errCorrection = secondCallMessages.find(
      (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('[格式错误]'),
    );
    expect(errCorrection).toBeDefined();
  });

  it('unknown type → role:user correction names the bad type', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"bogus_tool","param":{}}]')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    const secondMessages = spy.mock.calls[1]![1];
    const corr = secondMessages.find(
      (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('bogus_tool'),
    );
    expect(corr).toBeDefined();
  });

  it('done is emitted as a true tool type and terminates the loop', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(1); // done on first round → no iteration 2
  });

  it('every chatComplete call sees a conversation ending with role:user (Anthropic constraint)', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"view_user_signature","param":{}}]')
      .mockResolvedValueOnce('[{"type":"send_message","param":{"text":"hi"}}]')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    // Inspect every chatComplete call's messages argument.
    for (let i = 0; i < spy.mock.calls.length; i++) {
      const messages = spy.mock.calls[i]![1];
      const last = messages[messages.length - 1]!;
      expect(last.role, `call #${i + 1} last message role`).toBe('user');
    }
  });

  it('does NOT pass formatOverride (uses Tool Registry path)', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    const firstCallMessages = spy.mock.calls[0]![1];
    const firstSys = firstCallMessages.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes('[回复格式]'),
    )!.content as string;

    // Legacy ReAct-era markers should NOT appear
    expect(firstSys).not.toContain('Thought:');
    expect(firstSys).not.toContain('Actions:');
    expect(firstSys).not.toContain('ActionInput:');

    // M4.2.5 unified format markers SHOULD appear
    expect(firstSys).toContain('[回复格式]');
    expect(firstSys).toContain('{"type":"<type>","param":<param>}');
    expect(firstSys).toContain('[可用动作]');
    expect(firstSys).toContain('- send_message:');
    expect(firstSys).toContain('- done:');
  });

  it('experience disabled keeps the existing one-call done path', async () => {
    useHeartbeatStore.setState({
      configs: {
        [CHAR]: {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 5,
          aiChatMaxRounds: 3,
          virtualWorldStoryEnabled: false,
        },
      },
    } as never);
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('experience enabled writes the story before the tool loop sees memory', async () => {
    useHeartbeatStore.setState({
      configs: {
        [CHAR]: {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 5,
          aiChatMaxRounds: 3,
          virtualWorldStoryEnabled: true,
        },
      },
      lastHeartbeat: { [CHAR]: Date.now() - 24 * 60 * 60 * 1000 },
    } as never);
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('下午我试了一杯咸柠气泡水，后来把这个味道带进了晚饭。')
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(2);
    const secondCallMessages = spy.mock.calls[1]![1];
    const joined = secondCallMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(joined).toContain('[经历]');
    expect(joined).toContain('咸柠气泡水');
  });

  it('experience failure logs an error and continues tool loop', async () => {
    useHeartbeatStore.setState({
      configs: {
        [CHAR]: {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 5,
          aiChatMaxRounds: 3,
          virtualWorldStoryEnabled: true,
        },
      },
      lastHeartbeat: { [CHAR]: Date.now() - 24 * 60 * 60 * 1000 },
    } as never);
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockRejectedValueOnce(new Error('story failed'))
      .mockResolvedValueOnce('[{"type":"done","param":{}}]');

    await triggerHeartbeat(CHAR);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(useHeartbeatStore.getState().recentLog.some((entry) => entry.action === 'virtual_story_error')).toBe(true);
  });
});
