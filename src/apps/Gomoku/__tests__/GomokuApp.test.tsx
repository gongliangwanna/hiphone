import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GomokuApp } from '../GomokuApp';
import { createEmptyBoard, useGomokuStore } from '../gomokuStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { requestGomokuCharacterReply } from '../gomokuAiSession';

vi.mock('../gomokuAiSession', () => ({
  requestGomokuCharacterReply: vi.fn(async () => ({
    ok: true,
    texts: ['我先下这里。'],
    move: { row: 7, col: 7 },
    raw: '[]',
    items: [],
    attempts: 1,
  })),
}));

const mockedRequest = vi.mocked(requestGomokuCharacterReply);

function makeCharacter(id: string, name: string) {
  return {
    id,
    name,
    avatar: '/resource/avatars/preset-02.jpg',
    description: '认真下棋',
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
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useCharacterStore.setState({
    characters: [makeCharacter('char-001', '凛')],
    activeCharacterId: 'char-001',
  });
  useXYData.setState({
    userSettings: {
      nickname: '小星星',
      bio: '',
      accentColor: '#007AFF',
      avatarUrl: '/resource/avatars/cute.png',
      coverUrl: '',
    },
  });
  useGomokuStore.setState({
    board: createEmptyBoard(),
    currentPlayer: 'black',
    moves: [],
    result: null,
    mode: 'pve',
    scores: { user: 0, ai: 0 },
    characterId: 'char-001',
    userStone: 'black',
    aiStone: 'white',
    aiRequestKind: 'game',
    messages: [],
    aiStatus: 'idle',
    lastError: null,
    gameId: 'game-test',
    ignoredChatCount: 0,
    aiSilenced: false,
  });
});

describe('GomokuApp', () => {
  it('shows an empty state when no characters exist', () => {
    useCharacterStore.setState({ characters: [], activeCharacterId: '' });

    render(<GomokuApp />);

    expect(screen.getByTestId('gomoku-empty-state')).toBeInTheDocument();
    expect(screen.getByText('还没有 AI 角色')).toBeInTheDocument();
  });

  it('renders user and AI identity badges plus chat avatars', () => {
    useGomokuStore.setState({
      messages: [
        { id: 'm1', role: 'user', text: '你好', timestamp: 1 },
        { id: 'm2', role: 'ai', text: '来吧。', timestamp: 2 },
      ],
    });

    render(<GomokuApp />);

    expect(screen.getByTestId('gomoku-user-badge')).toHaveTextContent('你');
    expect(screen.getByTestId('gomoku-ai-badge')).toHaveTextContent('凛');
    expect(screen.getAllByTestId('gomoku-chat-avatar')).toHaveLength(2);
  });

  it('new game can set the user as white and trigger AI first move', async () => {
    render(<GomokuApp />);

    await userEvent.click(screen.getByTestId('gomoku-new-game-btn'));
    await userEvent.click(screen.getByTestId('gomoku-user-stone-white'));
    await userEvent.click(screen.getByTestId('gomoku-start-new-game'));

    await waitFor(() => {
      expect(mockedRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'char-001',
          turnKind: 'game',
        }),
      );
    });
    const state = useGomokuStore.getState();
    expect(state.userStone).toBe('white');
    expect(state.aiStone).toBe('black');
  });

  it('keeps the new game start action in a fixed safe-area footer', async () => {
    useCharacterStore.setState({
      characters: [
        makeCharacter('char-001', '凛'),
        makeCharacter('char-002', '澪'),
        makeCharacter('char-003', '遥'),
        makeCharacter('char-004', '葵'),
        makeCharacter('char-005', '奏'),
      ],
      activeCharacterId: 'char-001',
    });

    render(<GomokuApp />);

    await userEvent.click(screen.getByTestId('gomoku-new-game-btn'));

    const panel = screen.getByTestId('gomoku-new-game-panel');
    const scrollArea = screen.getByTestId('gomoku-new-game-scroll');
    const footer = screen.getByTestId('gomoku-new-game-footer');
    const startButton = screen.getByTestId('gomoku-start-new-game');

    expect(panel).toHaveClass('flex', 'flex-col', 'overflow-hidden');
    expect(scrollArea).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(footer).toHaveClass('shrink-0', 'pb-[var(--app-safe-bottom,12px)]');
    expect(footer).toContainElement(startButton);
    expect(scrollArea).not.toContainElement(startButton);
  });

  it('enters silence mode after repeated ignored chat replies', async () => {
    mockedRequest.mockRejectedValue(new Error('offline'));
    render(<GomokuApp />);

    const input = screen.getByTestId('gomoku-chat-input');
    await userEvent.type(input, '在吗');
    await userEvent.click(screen.getByTestId('gomoku-chat-send'));
    await waitFor(() => {
      expect(useGomokuStore.getState().ignoredChatCount).toBe(1);
    });

    await userEvent.type(input, '还在吗');
    await userEvent.click(screen.getByTestId('gomoku-chat-send'));
    await waitFor(() => {
      expect(useGomokuStore.getState().aiSilenced).toBe(true);
    });

    expect(screen.getByTestId('gomoku-chat-input')).toBeDisabled();
    expect(screen.getByText('凛一直没有回应,本局后续只下棋不聊天。')).toBeInTheDocument();
  });
});
