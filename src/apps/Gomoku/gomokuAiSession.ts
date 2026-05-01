import { chatWithCharacter, type ReplyItem } from '@/platform/userApp/sdk/ai';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import {
  BOARD_SIZE,
  useGomokuStore,
  type GomokuAiTurnKind,
} from './gomokuStore';
import { GOMOKU_APP_ID, registerGomokuAi } from './gomokuRegister';
import {
  buildGomokuPromptSnapshot,
  type GomokuPromptSnapshot,
} from './gomokuPrompt';

export interface GomokuAiMove {
  row: number;
  col: number;
}

export type GomokuAiValidationCode =
  | 'wrong-turn'
  | 'missing-place-stone'
  | 'multiple-place-stone'
  | 'invalid-place-param'
  | 'out-of-bounds'
  | 'occupied'
  | 'missing-text'
  | 'chat-included-place-stone';

export interface GomokuAiValidReply {
  ok: true;
  texts: string[];
  move: GomokuAiMove | null;
}

export interface GomokuAiInvalidReply {
  ok: false;
  code: GomokuAiValidationCode;
  message: string;
}

export type GomokuAiValidationResult =
  | GomokuAiValidReply
  | GomokuAiInvalidReply;

export type GomokuAiRequestResult =
  | (GomokuAiValidReply & {
      raw: string;
      items: ReplyItem[];
      attempts: number;
    })
  | (GomokuAiInvalidReply & {
      raw: string;
      items: ReplyItem[];
      attempts: number;
    });

export interface RequestGomokuCharacterReplyInput {
  characterId: string;
  turnKind: GomokuAiTurnKind;
  userMessage?: string;
  signal?: AbortSignal;
  maxSemanticAttempts?: number;
  onSemanticRetry?: (info: {
    attempt: number;
    error: GomokuAiInvalidReply;
  }) => void;
}

export function validateGomokuReply(
  items: readonly ReplyItem[],
  snapshot: GomokuPromptSnapshot,
): GomokuAiValidationResult {
  const parsedTexts = items
    .filter(
      (item): item is ReplyItem & { type: 'text'; param: string } =>
        item.type === 'text' && typeof item.param === 'string',
    )
    .map((item) => item.param)
    .filter((text) => text.trim().length > 0);
  const texts =
    snapshot.turnKind === 'game' && snapshot.aiSilenced ? [] : parsedTexts;
  const placeItems = items.filter((item) => item.type === 'place_stone');

  if (snapshot.turnKind === 'chat') {
    if (placeItems.length > 0) {
      return {
        ok: false,
        code: 'chat-included-place-stone',
        message: '纯聊天回合禁止输出 place_stone。',
      };
    }
    if (texts.length === 0) {
      return {
        ok: false,
        code: 'missing-text',
        message: '纯聊天回合必须至少输出一个 text。',
      };
    }
    return { ok: true, texts, move: null };
  }

  if (snapshot.currentPlayer !== snapshot.aiStone) {
    return {
      ok: false,
      code: 'wrong-turn',
      message: '当前没有轮到 AI 落子。',
    };
  }
  if (placeItems.length === 0) {
    return {
      ok: false,
      code: 'missing-place-stone',
      message: '棋局回合必须输出一个 place_stone。',
    };
  }
  if (placeItems.length > 1) {
    return {
      ok: false,
      code: 'multiple-place-stone',
      message: '棋局回合只能输出一个 place_stone。',
    };
  }

  const param = placeItems[0]!.param;
  if (param === null || typeof param !== 'object') {
    return {
      ok: false,
      code: 'invalid-place-param',
      message: 'place_stone.param 必须是 {row, col} 对象。',
    };
  }
  const { row, col } = param as { row?: unknown; col?: unknown };
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return {
      ok: false,
      code: 'invalid-place-param',
      message: 'place_stone 的 row/col 必须是整数。',
    };
  }
  const move = { row: row as number, col: col as number };
  if (
    move.row < 0 ||
    move.row >= BOARD_SIZE ||
    move.col < 0 ||
    move.col >= BOARD_SIZE
  ) {
    return {
      ok: false,
      code: 'out-of-bounds',
      message: 'place_stone 坐标越界。',
    };
  }
  if (snapshot.board[move.row]?.[move.col] !== null) {
    return {
      ok: false,
      code: 'occupied',
      message: 'place_stone 目标位置已经有棋子。',
    };
  }

  return { ok: true, texts, move };
}

export async function requestGomokuCharacterReply({
  characterId,
  turnKind,
  userMessage,
  signal,
  maxSemanticAttempts = 3,
  onSemanticRetry,
}: RequestGomokuCharacterReplyInput): Promise<GomokuAiRequestResult> {
  registerGomokuAi();

  const previousKind = useGomokuStore.getState().aiRequestKind;
  useGomokuStore.getState().setAiRequestKind(turnKind);
  const snapshot = buildGomokuPromptSnapshot(turnKind);

  try {
    const session = withUserAppContext(GOMOKU_APP_ID, () =>
      chatWithCharacter(characterId, {
        persistent: true,
        signal,
        onParseFailure: () => {
          // Gomoku owns inline retry/fallback UX in phase 3.
        },
      }),
    );

    const firstReply = await withUserAppContext(GOMOKU_APP_ID, async () => {
      if (turnKind === 'chat') {
        return session.send(userMessage?.trim() || '继续聊天。', {
          mirror: false,
        });
      }

      session.append(
        {
          role: 'user',
          speakerId: 'me',
          content:
            '轮到你在五子棋棋局中落子。请根据尾部棋盘状态输出工具数组。',
        },
        { mirror: false },
      );
      return session.replyToLast({ mirror: false });
    });

    let reply = firstReply;
    let validated = validateGomokuReply(reply.items, snapshot);
    let attempt = 1;

    while (!validated.ok && attempt < maxSemanticAttempts) {
      onSemanticRetry?.({ attempt, error: validated });
      session.append(
        {
          role: 'user',
          speakerId: 'system',
          content: [
            `[五子棋格式错误] 第 ${attempt} 次回复不合法:${validated.message}`,
            turnKind === 'game'
              ? '请重新输出 JSON 数组。本回合必须包含且只包含一个合法 place_stone,可选 text。'
              : '请重新输出 JSON 数组。本回合只能输出 text,禁止 place_stone。',
          ].join('\n'),
        },
        { mirror: false },
      );
      reply = await withUserAppContext(GOMOKU_APP_ID, () =>
        session.replyToLast({ mirror: false }),
      );
      attempt++;
      validated = validateGomokuReply(reply.items, snapshot);
    }

    if (!validated.ok) {
      onSemanticRetry?.({ attempt, error: validated });
    }

    return {
      ...validated,
      raw: reply.raw,
      items: reply.items,
      attempts: attempt,
    };
  } finally {
    useGomokuStore.getState().setAiRequestKind(previousKind);
  }
}
