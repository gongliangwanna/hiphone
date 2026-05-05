import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import {
  buildVirtualWorldStoryInstruction,
  calculateVirtualStoryTargetChars,
  generateVirtualWorldStoryForHeartbeat,
  resolveVirtualStoryStartTime,
} from '../heartbeatVirtualWorldStory';
import {
  _resetCharacterMemoryForTests,
  useCharacterMemory,
} from '../characterMemoryStore';
import * as chatCompleteMod from '../chatComplete';

const DAY = 24 * 60 * 60 * 1000;

describe('heartbeatVirtualWorldStory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await _resetCharacterMemoryForTests();
    useCharacterStore.setState({
      activeCharacterId: 'char-a',
      characters: [
        {
          id: 'char-a',
          name: '小星',
          avatar: '',
          description: '安静但行动具体',
          personality: '',
          scenario: '',
          firstMessage: '',
          messageExamples: '',
          alternateGreetings: [],
          systemPrompt: '',
          postHistoryInstructions: '',
          creatorNotes: '',
          tags: [],
          version: '',
        },
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
      personas: [{ id: 'p', name: '玩家', description: '喜欢热茶', avatar: '', isDefault: false }],
      activePersonaId: 'p',
    } as never);
    useWorldBookStore.setState({ entries: [] } as never);
    useXYData.setState({
      conversations: [
        { id: 'c-char-char-a', idolId: 'char-char-a', characterId: 'char-a', lastMsg: '', lastTime: 0, unread: 0 },
      ],
      messages: [],
      moments: [],
      characterSignatures: {},
      userSignatureHistory: [],
      interactions: [],
      unreadInteractionCount: 0,
      characterLastReadMsgTs: {},
      characterSeenInteractionCount: {},
      favorites: [],
      userSettings: { nickname: '玩家', bio: '', accentColor: '#000', avatarUrl: '', coverUrl: '' },
    } as never);
  });

  it('calculates 300 chars per elapsed day capped at 1000', () => {
    expect(calculateVirtualStoryTargetChars(1)).toBe(300);
    expect(calculateVirtualStoryTargetChars(2)).toBe(600);
    expect(calculateVirtualStoryTargetChars(4)).toBe(1000);
  });

  it('prefers the latest experience memory timestamp as the next start time', () => {
    useCharacterMemory.getState().append('char-a', {
      role: 'assistant',
      speakerId: 'char-char-a',
      source: 'heartbeat',
      content: '[经历]\n时间跨度：old\n\n旧经历\n[经历结束]',
    });
    const storyEntry = useCharacterMemory.getState().getAll('char-a')[0]!;
    const previousLastHeartbeat = storyEntry.createdAt - DAY;

    expect(resolveVirtualStoryStartTime({
      characterId: 'char-a',
      previousLastHeartbeat,
      intervalMinutes: 60,
      nowMs: storyEntry.createdAt + DAY,
    })).toBe(storyEntry.createdAt);
  });

  it('builds an instruction that forbids user and other AI characters from participating', () => {
    const instruction = buildVirtualWorldStoryInstruction({
      fromLabel: '2026-05-03 10:00',
      toLabel: '2026-05-04 10:00',
      elapsedDays: 1,
      targetChars: 300,
    });

    expect(instruction).toContain('不要让用户出现在事件中');
    expect(instruction).toContain('不要让其他 AI 角色出现在事件中');
    expect(instruction).toContain('只输出经历正文');
  });

  it('writes successful story generation as hidden heartbeat memory', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '下午我试了一杯咸柠气泡水，后来把这个味道带进了晚饭。',
    );

    const result = await generateVirtualWorldStoryForHeartbeat({
      characterId: 'char-a',
      previousLastHeartbeat: Date.now() - DAY,
      now: new Date('2026-05-04T10:00:00+08:00'),
      intervalMinutes: 60,
      signal: new AbortController().signal,
    });

    expect(result.written).toBe(true);
    const memoryText = useCharacterMemory.getState().getAll('char-a').map((e) => e.content).join('\n');
    expect(memoryText).toContain('[经历]');
    expect(memoryText).toContain('咸柠气泡水');
    expect(memoryText).toContain('[经历结束]');
    expect(memoryText.trim().endsWith('[经历结束]')).toBe(true);
  });

  it('does not write memory for blank output', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('   ');

    const result = await generateVirtualWorldStoryForHeartbeat({
      characterId: 'char-a',
      previousLastHeartbeat: Date.now() - DAY,
      now: new Date('2026-05-04T10:00:00+08:00'),
      intervalMinutes: 60,
      signal: new AbortController().signal,
    });

    expect(result.written).toBe(false);
    expect(useCharacterMemory.getState().getAll('char-a')).toHaveLength(0);
  });
});
