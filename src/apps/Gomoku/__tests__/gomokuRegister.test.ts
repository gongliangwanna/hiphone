import { beforeEach, describe, expect, it } from 'vitest';
import {
  getTools,
  _resetToolRegistryForTests,
} from '@/platform/ai/toolRegistry';
import {
  getAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import {
  getReplyRenderer,
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import { createEmptyBoard, useGomokuStore } from '../gomokuStore';
import {
  GOMOKU_APP_ID,
  _resetGomokuRegistrationForTests,
  registerGomokuAi,
} from '../gomokuRegister';

beforeEach(() => {
  _resetToolRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetGomokuRegistrationForTests();
  useGomokuStore.setState({
    board: createEmptyBoard(),
    currentPlayer: 'black',
    moves: [],
    result: null,
    characterId: 'char-001',
    userStone: 'black',
    aiStone: 'white',
    aiRequestKind: 'game',
  });
});

describe('registerGomokuAi', () => {
  it('registers only text and place_stone tools for gomoku', () => {
    registerGomokuAi();

    expect(getTools(GOMOKU_APP_ID).map((t) => t.type)).toEqual([
      'text',
      'place_stone',
    ]);
  });

  it('puts the live board matrix in tail tool context', () => {
    const board = createEmptyBoard();
    board[7]![7] = 'black';
    board[7]![8] = 'white';
    useGomokuStore.setState({
      board,
      currentPlayer: 'black',
      userStone: 'white',
      aiStone: 'black',
      moves: [
        { row: 7, col: 7, stone: 'black' },
        { row: 7, col: 8, stone: 'white' },
      ],
      aiRequestKind: 'game',
    });
    registerGomokuAi();

    const placeTool = getTools(GOMOKU_APP_ID).find(
      (tool) => tool.type === 'place_stone',
    );
    const tail = placeTool?.dynamicContext?.({
      appId: GOMOKU_APP_ID,
      characterId: 'char-001',
    });

    expect(placeTool?.contextAtTail).toBe(true);
    expect(tail).toContain('当前轮次: 棋局回合');
    expect(tail).toContain('棋盘矩阵');
    expect(tail).toContain('. . . . . . . B W . . . . . .');
    expect(tail).toContain('H8 黑');
    expect(tail).toContain('I8 白');
    expect(tail).toContain('必须输出一个且仅一个 place_stone');
  });

  it('keeps the static app prompt free of the live board matrix', () => {
    registerGomokuAi();

    const prompt = getAppSystemPrompt(GOMOKU_APP_ID)?.() ?? '';

    expect(prompt).toContain('五子棋');
    expect(prompt).not.toContain('棋盘矩阵');
    expect(prompt).not.toContain('15x15');
  });

  it('renders place_stone replies as readable move text', () => {
    registerGomokuAi();

    const rendered = getReplyRenderer(GOMOKU_APP_ID).render(
      '[{"type":"text","param":"我先压住这里。"},{"type":"place_stone","param":{"row":7,"col":8}}]',
      { speakerName: '凛', tools: getTools(GOMOKU_APP_ID) },
    );

    expect(rendered).toBe('我先压住这里。\n落子到 I8。');
  });
});
