import { registerAppSystemPrompt } from '@/platform/ai/appSystemPromptRegistry';
import { parseReply } from '@/platform/ai/replyParser';
import { registerReplyRenderer } from '@/platform/ai/replyRendererRegistry';
import { registerTools } from '@/platform/ai/toolRegistry';
import {
  buildGomokuPromptTailFromStore,
  formatGomokuCoordinate,
} from './gomokuPrompt';

export const GOMOKU_APP_ID = 'gomoku';

let registered = false;

export function registerGomokuAi(): void {
  if (registered) return;
  registered = true;

  registerTools(GOMOKU_APP_ID, [
    {
      type: 'text',
      description: '和用户聊天。棋局回合可选,纯聊天回合必选',
      param: 'string (自然语言聊天内容)',
    },
    {
      type: 'place_stone',
      description:
        '在五子棋棋盘上落子。只能在棋局回合使用; row/col 是 0-based 坐标',
      param: '{row: number, col: number}',
      dynamicContext: () => buildGomokuPromptTailFromStore(),
      contextAtTail: true,
    },
  ]);

  registerAppSystemPrompt(GOMOKU_APP_ID, () =>
    [
      '你正在和用户下一局五子棋。',
      '你是当前用户选择的 AI 角色,需要保持角色性格,但棋局决策必须认真。',
      '棋盘状态会在 prompt 尾部提供,不要请求额外的看棋工具。',
      '只使用可用动作回复,不要输出 JSON 数组以外的文字。',
      '第一版规则按标准五子棋处理: 横、竖、斜任意五连获胜,暂不考虑复杂禁手。',
    ].join('\n'),
  );

  registerReplyRenderer(GOMOKU_APP_ID, {
    render(raw) {
      const { items, error } = parseReply(
        raw,
        new Set(['text', 'place_stone']),
      );
      if (error !== null || items.length === 0) return raw;

      return items
        .map((item) => {
          if (item.type === 'text' && typeof item.param === 'string') {
            return item.param;
          }
          if (
            item.type === 'place_stone' &&
            item.param !== null &&
            typeof item.param === 'object'
          ) {
            const param = item.param as { row?: unknown; col?: unknown };
            if (
              Number.isInteger(param.row) &&
              Number.isInteger(param.col)
            ) {
              return `落子到 ${formatGomokuCoordinate(
                param.row as number,
                param.col as number,
              )}。`;
            }
          }
          const paramText =
            typeof item.param === 'string'
              ? item.param
              : JSON.stringify(item.param);
          return `【${item.type}】${paramText}`;
        })
        .join('\n');
    },
  });
}

export function _resetGomokuRegistrationForTests(): void {
  registered = false;
}
