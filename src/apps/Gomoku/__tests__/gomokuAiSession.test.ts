import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import {
  _resetCharacterAppStateForTests,
} from '@/platform/ai/characterAppState';
import {
  _resetToolRegistryForTests,
} from '@/platform/ai/toolRegistry';
import {
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import {
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import * as chatCompleteMod from '@/platform/ai/chatComplete';
import { createEmptyBoard, useGomokuStore } from '../gomokuStore';
import { _resetGomokuRegistrationForTests } from '../gomokuRegister';
import {
  requestGomokuCharacterReply,
  validateGomokuReply,
} from '../gomokuAiSession';
import { buildGomokuPromptSnapshot } from '../gomokuPrompt';

beforeEach(() => {
  vi.restoreAllMocks();
  _resetCharacterAppStateForTests();
  _resetToolRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetGomokuRegistrationForTests();
  useCharacterMemory.getState().clearAll();
  useCharacterStore.setState({
    characters: [
      {
        id: 'char-001',
        name: '凛',
        avatar: '/avatar.png',
        description: '',
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
  useGomokuStore.setState({
    board: createEmptyBoard(),
    currentPlayer: 'white',
    moves: [],
    result: null,
    characterId: 'char-001',
    userStone: 'black',
    aiStone: 'white',
    aiRequestKind: 'game',
    ignoredChatCount: 0,
    aiSilenced: false,
  });
});

describe('validateGomokuReply', () => {
  it('accepts text plus one legal place_stone in a game turn', () => {
    const board = createEmptyBoard();
    board[7]![7] = 'black';
    useGomokuStore.setState({ board, currentPlayer: 'white' });

    const result = validateGomokuReply(
      [
        { type: 'text', param: '我下这里。' },
        { type: 'place_stone', param: { row: 7, col: 8 } },
      ],
      buildGomokuPromptSnapshot('game'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.texts).toEqual(['我下这里。']);
      expect(result.move).toEqual({ row: 7, col: 8 });
    }
  });

  it('rejects a game turn that does not include place_stone', () => {
    const result = validateGomokuReply(
      [{ type: 'text', param: '我想一想。' }],
      buildGomokuPromptSnapshot('game'),
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'missing-place-stone',
    });
  });

  it('rejects an occupied target', () => {
    const board = createEmptyBoard();
    board[7]![7] = 'black';
    useGomokuStore.setState({ board });

    const result = validateGomokuReply(
      [{ type: 'place_stone', param: { row: 7, col: 7 } }],
      buildGomokuPromptSnapshot('game'),
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'occupied',
    });
  });

  it('accepts pure chat with text and no move', () => {
    const result = validateGomokuReply(
      [{ type: 'text', param: '当然可以聊。' }],
      buildGomokuPromptSnapshot('chat'),
    );

    expect(result).toMatchObject({
      ok: true,
      texts: ['当然可以聊。'],
      move: null,
    });
  });

  it('rejects place_stone during pure chat', () => {
    const result = validateGomokuReply(
      [
        { type: 'text', param: '边聊边试一手。' },
        { type: 'place_stone', param: { row: 7, col: 7 } },
      ],
      buildGomokuPromptSnapshot('chat'),
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'chat-included-place-stone',
    });
  });
});

describe('requestGomokuCharacterReply', () => {
  it('sends a game turn through chatWithCharacter with the board at prompt tail', async () => {
    const board = createEmptyBoard();
    board[7]![7] = 'black';
    useGomokuStore.setState({
      board,
      currentPlayer: 'white',
      moves: [{ row: 7, col: 7, stone: 'black' }],
    });
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"我压住这里。"},{"type":"place_stone","param":{"row":7,"col":8}}]',
    );

    const reply = await requestGomokuCharacterReply({
      characterId: 'char-001',
      turnKind: 'game',
    });

    expect(reply.ok).toBe(true);
    if (reply.ok) {
      expect(reply.texts).toEqual(['我压住这里。']);
      expect(reply.move).toEqual({ row: 7, col: 8 });
    }

    const messages = chatSpy.mock.calls[0]![1];
    const prompt = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n\n');
    expect(prompt).toContain('[工具状态]');
    expect(prompt).toContain('棋盘矩阵');
    expect(prompt).toContain('. . . . . . . B . . . . . . .');
    expect(prompt).toContain('当前轮次: 棋局回合');

    const memoryText = useCharacterMemory
      .getState()
      .getAll('char-001')
      .map((entry) => entry.content)
      .join('\n');
    expect(memoryText).not.toContain('棋盘矩阵');
    expect(memoryText).not.toContain('. . . . . . . B . . . . . . .');
  });

  it('ignores text and prompts for place_stone only after silence mode', async () => {
    useGomokuStore.setState({ aiSilenced: true });
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"这句话会被忽略。"},{"type":"place_stone","param":{"row":7,"col":7}}]',
    );

    const reply = await requestGomokuCharacterReply({
      characterId: 'char-001',
      turnKind: 'game',
    });

    expect(reply.ok).toBe(true);
    if (reply.ok) {
      expect(reply.texts).toEqual([]);
      expect(reply.move).toEqual({ row: 7, col: 7 });
    }
    const prompt = chatSpy.mock.calls[0]![1]
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n\n');
    expect(prompt).toContain('本局沉默模式下禁止输出 text');
    expect(prompt).toContain('用户已经决定本局只下棋不聊天');
  });

  it('sends a pure chat turn without allowing place_stone', async () => {
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"可以,我一边看棋一边和你聊。"}]',
    );

    const reply = await requestGomokuCharacterReply({
      characterId: 'char-001',
      turnKind: 'chat',
      userMessage: '先聊两句',
    });

    expect(reply).toMatchObject({
      ok: true,
      texts: ['可以,我一边看棋一边和你聊。'],
      move: null,
    });

    const messages = chatSpy.mock.calls[0]![1];
    const prompt = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n\n');
    expect(prompt).toContain('当前轮次: 纯聊天回合');
    expect(prompt).toContain('本回合禁止输出 place_stone');
  });

  it('retries semantic errors and succeeds when a legal move arrives', async () => {
    const chatSpy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('[{"type":"text","param":"我想想。"}]')
      .mockResolvedValueOnce(
        '[{"type":"text","param":"改下这里。"},{"type":"place_stone","param":{"row":7,"col":7}}]',
      );
    const retrySpy = vi.fn();

    const reply = await requestGomokuCharacterReply({
      characterId: 'char-001',
      turnKind: 'game',
      onSemanticRetry: retrySpy,
    });

    expect(reply.ok).toBe(true);
    expect(reply.attempts).toBe(2);
    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(retrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        error: expect.objectContaining({ code: 'missing-place-stone' }),
      }),
    );
  });

  it('returns invalid after three semantic failures', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue(
      '[{"type":"text","param":"不下。"}]',
    );

    const reply = await requestGomokuCharacterReply({
      characterId: 'char-001',
      turnKind: 'game',
    });

    expect(reply).toMatchObject({
      ok: false,
      code: 'missing-place-stone',
      attempts: 3,
    });
  });
});
