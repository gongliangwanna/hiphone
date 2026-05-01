import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import {
  buildPresenceModeInstruction,
  buildPresencePromptMessages,
  parsePresenceSummary,
} from '../presenceAi';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
  useCharacterStore.setState({
    characters: [
      {
        id: 'char-001',
        name: '星羽',
        avatar: '/avatar.png',
        description: '温柔但有一点倔强。',
        personality: '',
        scenario: '',
        firstMessage: '',
        messageExamples: '',
        alternateGreetings: [],
        systemPrompt: '',
        postHistoryInstructions: '',
        creatorNotes: '',
        tags: [],
        version: '1.0',
      },
    ],
    activeCharacterId: 'char-001',
  });
  usePersonaStore.setState({
    activePersonaId: null,
    personas: [{ id: 'p', name: '玩家', description: '' }],
    getActivePersona: () => ({ id: 'p', name: '玩家', description: '' }),
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
});

describe('presenceAi', () => {
  it('uses soft scene guidance instead of a hard JSON protocol', () => {
    const prompt = buildPresenceModeInstruction('雨夜便利店');

    expect(prompt).toContain('不是在聊天软件里回复消息');
    expect(prompt).toContain('和玩家面对面互动');
    expect(prompt).toContain('自由');
    expect(prompt).toContain('不需要遵循固定 JSON');
  });

  it('builds prompt messages with temporary turns and no JSON reply format block', () => {
    const messages = buildPresencePromptMessages({
      characterId: 'char-001',
      sceneText: '雨夜便利店',
      turns: [
        {
          id: 't1',
          role: 'user',
          content: '我走到她身边。',
          createdAt: 1,
        },
      ],
    });
    const text = messages
      .map((message) =>
        typeof message.content === 'string' ? message.content : '',
      )
      .join('\n');

    expect(text).toContain('雨夜便利店');
    expect(text).toContain('玩家：我走到她身边。');
    expect(text).not.toContain('[回复格式]');
    expect(text).not.toContain('只输出 JSON 数组');
  });

  it('parses the three summary fields and supports SKIP', () => {
    expect(parsePresenceSummary('SKIP')).toBeNull();

    expect(
      parsePresenceSummary(
        [
          '场景：雨中便利店',
          '发生了什么：用户解释迟到。',
          '情绪变化：变得柔和。',
        ].join('\n'),
      ),
    ).toEqual({
      scene: '雨中便利店',
      whatHappened: '用户解释迟到。',
      emotionalShift: '变得柔和。',
    });
  });

  it('ignores legacy next-thread summary fields', () => {
    const summary = parsePresenceSummary(
      [
        '场景：雨中便利店',
        '发生了什么：用户解释迟到。',
        '情绪变化：变得柔和。',
        '待续事项：下次提前说明。',
      ].join('\n'),
    );

    expect(summary).toEqual({
      scene: '雨中便利店',
      whatHappened: '用户解释迟到。',
      emotionalShift: '变得柔和。',
    });
  });
});
