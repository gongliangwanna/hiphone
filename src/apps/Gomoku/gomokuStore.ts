import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { uid } from '@/platform/utils/uid';

export const BOARD_SIZE = 15;
export type Stone = 'black' | 'white' | null;
export type PlayerStone = Exclude<Stone, null>;
export type GameMode = 'pvp' | 'pve';
export type GameResult = { winner: PlayerStone; line: [number, number][] } | null;
export type GomokuAiTurnKind = 'game' | 'chat';
export type GomokuAiStatus =
  | 'idle'
  | 'thinking'
  | 'retrying'
  | 'failed'
  | 'fallback';

export interface Move {
  row: number;
  col: number;
  stone: PlayerStone;
}

export interface GomokuScores {
  user: number;
  ai: number;
}

export interface GomokuMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

interface StartNewGameInput {
  characterId: string;
  userStone: PlayerStone;
}

interface GomokuState {
  board: Stone[][];
  currentPlayer: PlayerStone;
  moves: Move[];
  result: GameResult;
  mode: GameMode;
  scores: GomokuScores;
  characterId: string;
  userStone: PlayerStone;
  aiStone: PlayerStone;
  aiRequestKind: GomokuAiTurnKind;
  messages: GomokuMessage[];
  aiStatus: GomokuAiStatus;
  lastError: string | null;
  gameId: string;
  ignoredChatCount: number;
  aiSilenced: boolean;

  placeStone: (row: number, col: number) => boolean;
  undo: () => void;
  reset: () => void;
  setMode: (mode: GameMode) => void;
  setCharacterId: (characterId: string) => void;
  setUserStone: (stone: PlayerStone) => void;
  setAiRequestKind: (kind: GomokuAiTurnKind) => void;
  setAiStatus: (status: GomokuAiStatus, lastError?: string | null) => void;
  noteAiChatResult: (responded: boolean) => void;
  setAiSilenced: (silenced: boolean) => void;
  addMessage: (message: Omit<GomokuMessage, 'id' | 'timestamp'>) => GomokuMessage;
  clearMessages: () => void;
  startNewGame: (input: StartNewGameInput) => void;
}

export function createEmptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array<Stone>(BOARD_SIZE).fill(null),
  );
}

export function getOppositeStone(stone: PlayerStone): PlayerStone {
  return stone === 'black' ? 'white' : 'black';
}

export function checkWin(
  board: Stone[][],
  row: number,
  col: number,
  stone: Stone,
): [number, number][] | null {
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    const line: [number, number][] = [[row, col]];

    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r]![c] !== stone) break;
      line.push([r, c]);
    }

    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r]![c] !== stone) break;
      line.push([r, c]);
    }

    if (line.length >= 5) {
      line.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return line;
    }
  }

  return null;
}

function createGameId(): string {
  return `gomoku-${Date.now()}-${uid()}`;
}

function normalizeScores(value: unknown): GomokuScores {
  if (value && typeof value === 'object') {
    const scoreLike = value as {
      user?: unknown;
      ai?: unknown;
      black?: unknown;
      white?: unknown;
    };
    return {
      user:
        typeof scoreLike.user === 'number'
          ? scoreLike.user
          : typeof scoreLike.black === 'number'
            ? scoreLike.black
            : 0,
      ai:
        typeof scoreLike.ai === 'number'
          ? scoreLike.ai
          : typeof scoreLike.white === 'number'
            ? scoreLike.white
            : 0,
    };
  }
  return { user: 0, ai: 0 };
}

export const useGomokuStore = create<GomokuState>()(
  persist(
    (set, get) => ({
      board: createEmptyBoard(),
      currentPlayer: 'black',
      moves: [],
      result: null,
      mode: 'pve',
      scores: { user: 0, ai: 0 },
      characterId: '',
      userStone: 'black',
      aiStone: 'white',
      aiRequestKind: 'game',
      messages: [],
      aiStatus: 'idle',
      lastError: null,
      gameId: createGameId(),
      ignoredChatCount: 0,
      aiSilenced: false,

      placeStone: (row: number, col: number) => {
        const {
          board,
          currentPlayer,
          moves,
          result,
          scores,
          userStone,
          aiStone,
        } = get();
        if (result) return false;
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
          return false;
        if (board[row]?.[col] !== null) return false;

        const newBoard = board.map((r) => [...r]);
        newBoard[row]![col] = currentPlayer;

        const winLine = checkWin(newBoard, row, col, currentPlayer);
        const newResult: GameResult = winLine
          ? { winner: currentPlayer, line: winLine }
          : null;

        const safeScores = normalizeScores(scores);
        const newScores = newResult
          ? {
              user:
                newResult.winner === userStone
                  ? safeScores.user + 1
                  : safeScores.user,
              ai:
                newResult.winner === aiStone
                  ? safeScores.ai + 1
                  : safeScores.ai,
            }
          : safeScores;

        set({
          board: newBoard,
          currentPlayer: getOppositeStone(currentPlayer),
          moves: [...moves, { row, col, stone: currentPlayer }],
          result: newResult,
          scores: newScores,
        });

        return true;
      },

      undo: () => {
        const { moves, result, mode } = get();
        if (moves.length === 0) return;

        const stepsToUndo =
          mode === 'pve' && moves.length >= 2 && !result ? 2 : 1;
        const newMoves = moves.slice(0, -stepsToUndo);

        const newBoard = createEmptyBoard();
        for (const m of newMoves) {
          newBoard[m.row]![m.col] = m.stone;
        }

        const lastMove = newMoves[newMoves.length - 1];
        const nextPlayer: PlayerStone = lastMove
          ? getOppositeStone(lastMove.stone)
          : 'black';

        set({
          board: newBoard,
          moves: newMoves,
          currentPlayer: nextPlayer,
          result: null,
          aiStatus: 'idle',
          lastError: null,
        });
      },

      reset: () => {
        set({
          board: createEmptyBoard(),
          currentPlayer: 'black',
          moves: [],
          result: null,
          aiStatus: 'idle',
          lastError: null,
          gameId: createGameId(),
          ignoredChatCount: 0,
          aiSilenced: false,
        });
      },

      setMode: (mode: GameMode) => {
        set({ mode });
        get().reset();
      },

      setCharacterId: (characterId: string) => {
        set({ characterId });
      },

      setUserStone: (stone: PlayerStone) => {
        set({
          userStone: stone,
          aiStone: getOppositeStone(stone),
        });
        get().reset();
      },

      setAiRequestKind: (kind: GomokuAiTurnKind) => {
        set({ aiRequestKind: kind });
      },

      setAiStatus: (aiStatus, lastError = null) => {
        set({ aiStatus, lastError });
      },

      noteAiChatResult: (responded) => {
        if (responded) {
          set({ ignoredChatCount: 0 });
          return;
        }
        const next = get().ignoredChatCount + 1;
        set({
          ignoredChatCount: next,
          aiSilenced: next >= 2,
        });
      },

      setAiSilenced: (aiSilenced) => {
        set({
          aiSilenced,
          ignoredChatCount: aiSilenced ? get().ignoredChatCount : 0,
        });
      },

      addMessage: (message) => {
        const entry: GomokuMessage = {
          ...message,
          id: uid(),
          timestamp: Date.now(),
        };
        set((state) => ({
          messages: [...state.messages, entry],
        }));
        return entry;
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      startNewGame: ({ characterId, userStone }) => {
        set({
          board: createEmptyBoard(),
          currentPlayer: 'black',
          moves: [],
          result: null,
          mode: 'pve',
          characterId,
          userStone,
          aiStone: getOppositeStone(userStone),
          aiRequestKind: 'game',
          messages: [],
          aiStatus: 'idle',
          lastError: null,
          ignoredChatCount: 0,
          aiSilenced: false,
          gameId: createGameId(),
          scores: normalizeScores(get().scores),
        });
      },
    }),
    {
      name: 'hiPhone-gomoku',
      storage: idbStorage,
      partialize: (state) => ({
        board: state.board,
        currentPlayer: state.currentPlayer,
        moves: state.moves,
        result: state.result,
        mode: state.mode,
        scores: state.scores,
        characterId: state.characterId,
        userStone: state.userStone,
        aiStone: state.aiStone,
        messages: state.messages,
        aiStatus: state.aiStatus,
        lastError: state.lastError,
        gameId: state.gameId,
        ignoredChatCount: state.ignoredChatCount,
        aiSilenced: state.aiSilenced,
      }),
      merge: (persisted, current) => {
        const incoming =
          persisted && typeof persisted === 'object'
            ? (persisted as Partial<GomokuState>)
            : {};
        return {
          ...current,
          ...incoming,
          scores: normalizeScores(incoming.scores),
          userStone: incoming.userStone ?? current.userStone,
          aiStone:
            incoming.aiStone ??
            getOppositeStone(incoming.userStone ?? current.userStone),
          messages: incoming.messages ?? current.messages,
          aiStatus: 'idle',
          lastError: null,
          gameId: incoming.gameId ?? current.gameId,
          ignoredChatCount: incoming.ignoredChatCount ?? 0,
          aiSilenced: incoming.aiSilenced ?? false,
        };
      },
    },
  ),
);
