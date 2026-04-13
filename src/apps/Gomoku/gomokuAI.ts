import { BOARD_SIZE, type Stone } from './gomokuStore';

/**
 * Heuristic Gomoku AI.
 * Evaluates every empty cell by scoring patterns in all 4 directions,
 * then picks the highest-scoring move.
 */

const FIVE = 1_000_000;
const OPEN_FOUR = 100_000;
const FOUR = 10_000;
const OPEN_THREE = 5_000;
const THREE = 500;
const OPEN_TWO = 200;
const TWO = 50;
const ONE = 10;

interface LineInfo {
  count: number;
  openEnds: number;
}

function readLine(
  board: Stone[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): LineInfo {
  let count = 0;
  let openEnds = 0;

  // forward
  let r = row + dr;
  let c = col + dc;
  while (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r]![c] === stone
  ) {
    count++;
    r += dr;
    c += dc;
  }
  if (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r]![c] === null
  ) {
    openEnds++;
  }

  // backward
  r = row - dr;
  c = col - dc;
  while (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r]![c] === stone
  ) {
    count++;
    r -= dr;
    c -= dc;
  }
  if (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r]![c] === null
  ) {
    openEnds++;
  }

  return { count, openEnds };
}

function scoreLine(info: LineInfo): number {
  const { count, openEnds } = info;
  if (openEnds === 0 && count < 5) return 0;

  if (count >= 5) return FIVE;
  if (count === 4) return openEnds === 2 ? OPEN_FOUR : FOUR;
  if (count === 3) return openEnds === 2 ? OPEN_THREE : THREE;
  if (count === 2) return openEnds === 2 ? OPEN_TWO : TWO;
  if (count === 1) return openEnds === 2 ? ONE : 0;
  return 0;
}

function evaluateCell(
  board: Stone[][],
  row: number,
  col: number,
  stone: Stone,
): number {
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  let total = 0;
  for (const [dr, dc] of directions) {
    const info = readLine(board, row, col, dr, dc, stone);
    total += scoreLine(info);
  }
  return total;
}

export function getAIMove(
  board: Stone[][],
  aiStone: 'black' | 'white',
): [number, number] | null {
  const humanStone: Stone = aiStone === 'black' ? 'white' : 'black';

  let bestScore = -1;
  let bestMoves: [number, number][] = [];

  const candidates = getCandidates(board);

  // If board is empty, play center
  if (candidates.length === 0) {
    return [Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2)];
  }

  for (const [row, col] of candidates) {
    const offenseScore = evaluateCell(board, row, col, aiStone);
    const defenseScore = evaluateCell(board, row, col, humanStone);
    const score = offenseScore * 1.1 + defenseScore;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [[row, col]];
    } else if (score === bestScore) {
      bestMoves.push([row, col]);
    }
  }

  if (bestMoves.length === 0) return null;

  return bestMoves[Math.floor(Math.random() * bestMoves.length)]!;
}

function getCandidates(board: Stone[][]): [number, number][] {
  const seen = new Set<string>();
  const candidates: [number, number][] = [];
  const range = 2;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] === null) continue;
      for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE)
            continue;
          if (board[nr]![nc] !== null) continue;
          const key = `${nr},${nc}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push([nr, nc]);
        }
      }
    }
  }

  return candidates;
}
