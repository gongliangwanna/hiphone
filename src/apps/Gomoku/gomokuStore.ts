import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

export const BOARD_SIZE = 15;
export type Stone = 'black' | 'white' | null;
export type GameMode = 'pvp' | 'pve';
export type GameResult = { winner: 'black' | 'white'; line: [number, number][] } | null;

interface Move {
  row: number;
  col: number;
  stone: 'black' | 'white';
}

interface GomokuState {
  board: Stone[][];
  currentPlayer: 'black' | 'white';
  moves: Move[];
  result: GameResult;
  mode: GameMode;
  scores: { black: number; white: number };

  placeStone: (row: number, col: number) => boolean;
  undo: () => void;
  reset: () => void;
  setMode: (mode: GameMode) => void;
}

function createEmptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array<Stone>(BOARD_SIZE).fill(null),
  );
}

function checkWin(
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

export const useGomokuStore = create<GomokuState>()(
  persist(
    (set, get) => ({
      board: createEmptyBoard(),
      currentPlayer: 'black' as const,
      moves: [] as Move[],
      result: null as GameResult,
      mode: 'pve' as GameMode,
      scores: { black: 0, white: 0 },

      placeStone: (row: number, col: number) => {
        const { board, currentPlayer, moves, result } = get();
        if (result) return false;
        if (board[row]![col] !== null) return false;

        const newBoard = board.map((r) => [...r]);
        newBoard[row]![col] = currentPlayer;

        const winLine = checkWin(newBoard, row, col, currentPlayer);
        const newResult: GameResult = winLine
          ? { winner: currentPlayer, line: winLine }
          : null;

        const { scores } = get();
        const newScores = newResult
          ? { ...scores, [currentPlayer]: scores[currentPlayer] + 1 }
          : scores;

        set({
          board: newBoard,
          currentPlayer: currentPlayer === 'black' ? 'white' : 'black',
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
        const nextPlayer: 'black' | 'white' = lastMove
          ? lastMove.stone === 'black'
            ? 'white'
            : 'black'
          : 'black';

        set({
          board: newBoard,
          moves: newMoves,
          currentPlayer: nextPlayer,
          result: null,
        });
      },

      reset: () => {
        set({
          board: createEmptyBoard(),
          currentPlayer: 'black' as const,
          moves: [],
          result: null,
        });
      },

      setMode: (mode: GameMode) => {
        set({ mode });
        get().reset();
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
      }),
    },
  ),
);
