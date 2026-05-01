import {
  BOARD_SIZE,
  useGomokuStore,
  type GomokuAiTurnKind,
  type Move,
  type PlayerStone,
  type Stone,
} from './gomokuStore';

export interface GomokuPromptSnapshot {
  board: Stone[][];
  currentPlayer: PlayerStone;
  moves: Move[];
  userStone: PlayerStone;
  aiStone: PlayerStone;
  turnKind: GomokuAiTurnKind;
  aiSilenced: boolean;
}

const COORD_COLUMNS = 'ABCDEFGHIJKLMNO';

export function formatGomokuCoordinate(row: number, col: number): string {
  const column = COORD_COLUMNS[col] ?? '?';
  return `${column}${row + 1}`;
}

export function stoneLabel(stone: PlayerStone): string {
  return stone === 'black' ? '黑' : '白';
}

export function serializeBoardMatrix(board: Stone[][]): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell === 'black') return 'B';
          if (cell === 'white') return 'W';
          return '.';
        })
        .join(' '),
    )
    .join('\n');
}

export function buildGomokuPromptSnapshot(
  turnKind?: GomokuAiTurnKind,
): GomokuPromptSnapshot {
  const state = useGomokuStore.getState();
  return {
    board: state.board.map((row) => [...row]),
    currentPlayer: state.currentPlayer,
    moves: [...state.moves],
    userStone: state.userStone,
    aiStone: state.aiStone,
    turnKind: turnKind ?? state.aiRequestKind,
    aiSilenced: state.aiSilenced,
  };
}

export function buildGomokuPromptTail(
  snapshot: GomokuPromptSnapshot,
): string {
  const recentMoves = snapshot.moves.slice(-8);
  const recentMoveText =
    recentMoves.length === 0
      ? '无'
      : recentMoves
          .map(
            (move, index) =>
              `${snapshot.moves.length - recentMoves.length + index + 1}. ${formatGomokuCoordinate(move.row, move.col)} ${stoneLabel(move.stone)}`,
          )
          .join('\n');

  const turnLabel =
    snapshot.turnKind === 'game' ? '棋局回合' : '纯聊天回合';
  const currentOwner =
    snapshot.currentPlayer === snapshot.aiStone
      ? 'AI'
      : snapshot.currentPlayer === snapshot.userStone
        ? '用户'
        : '未知';
  const rules =
    snapshot.turnKind === 'game'
      ? snapshot.aiSilenced
        ? [
            '本回合是棋局回合。',
            '用户已经决定本局只下棋不聊天。',
            '你必须输出一个且仅一个 place_stone。',
            '本局沉默模式下禁止输出 text,不要说话。',
            'place_stone 的 row/col 必须是 0 到 14 的整数,且必须落在空位。',
          ]
        : [
            '本回合是棋局回合。',
            '你必须输出一个且仅一个 place_stone。',
            '可以额外输出 text,用于边下棋边说话。',
            'place_stone 的 row/col 必须是 0 到 14 的整数,且必须落在空位。',
          ]
      : [
          '本回合是纯聊天回合。',
          '你必须至少输出一个 text。',
          '本回合禁止输出 place_stone。',
          '不要改变棋盘和当前执棋方。',
        ];

  return [
    '[五子棋运行态]',
    '当前 App: 五子棋',
    `当前轮次: ${turnLabel}`,
    `棋盘规格: ${BOARD_SIZE}x${BOARD_SIZE}`,
    `用户执棋: ${stoneLabel(snapshot.userStone)}`,
    `AI 执棋: ${stoneLabel(snapshot.aiStone)}`,
    `当前轮到: ${currentOwner} ${stoneLabel(snapshot.currentPlayer)}`,
    '',
    '棋盘矩阵 (. 空位, B 黑棋, W 白棋):',
    serializeBoardMatrix(snapshot.board),
    '',
    '最近落子:',
    recentMoveText,
    '',
    '本轮输出约束:',
    ...rules.map((line) => `- ${line}`),
  ].join('\n');
}

export function buildGomokuPromptTailFromStore(): string {
  return buildGomokuPromptTail(buildGomokuPromptSnapshot());
}
