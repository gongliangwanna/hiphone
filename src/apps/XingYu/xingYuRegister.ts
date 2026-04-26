/**
 * XingYu's AI-integration bootstrap.
 *
 * Registers the app's tools + appSystemPrompt under appId "xingyu".
 * Called once from xingYuDataStore at module import time. Idempotent.
 *
 * M4.2.5: tools use the unified {type, param} shape. `text` is now an
 * explicit app-registered tool (previously implicit via platform chunk 7).
 * No custom renderer is registered — the platform-default renderer
 * produces "<speaker>: <param>" for text and "<speaker>: 【<type>】JSON"
 * for sticker/update_signature. XingYu accepts that cosmetic output.
 *
 * See docs/superpowers/specs/2026-04-20-m4.2.5-unified-tool-wire-format-design.md §XingYu 迁移对照
 */

import { registerTools } from '@/platform/ai/toolRegistry';
import { registerAppSystemPrompt } from '@/platform/ai/appSystemPromptRegistry';
import { useStickerStore } from './stickerStore';

export const XINGYU_APP_ID = 'xingyu';

let registered = false;

export function registerXingYuAi(): void {
  if (registered) return;
  registered = true;

  registerTools(XINGYU_APP_ID, [
    {
      type: 'text',
      description: '发一条聊天消息,像真人发微信',
      param: 'string (消息内容)',
    },
    {
      type: 'sticker',
      description:
        '发一个表情包。stickerId 必须从 [当前任务] 中列出的可用表情里选,不要编造',
      param: '{stickerId: string, content: string (表情简短描述)}',
    },
    {
      type: 'update_signature',
      description: '修改个性签名,不要频繁更换,只有在心情或状态明显变化时才调用',
      param: '{text: string}',
    },
  ]);

  // NOTE: no registerReplyRenderer — the platform default works fine.

  registerAppSystemPrompt(XINGYU_APP_ID, () => {
    const stickers = useStickerStore
      .getState()
      .packs.flatMap((pack) =>
        pack.stickers.map((s) => ({ id: s.id, description: s.description })),
      );

    const lines: string[] = [
      '这是一场类似微信的即时聊天场景,请遵守以下风格:',
      '- 用用户的语言回复,保持角色性格',
      '- 每条消息简短自然,像真人聊微信——不要一次发很长的文本,拆成多条短消息更有活人感',
      '- 不要使用动作描述(如 *叹气*、*微笑*)',
      '- 不要使用 markdown 格式',
    ];

    if (stickers.length > 0) {
      lines.push(
        '- 表情包请克制使用:整段对话最多 0-1 个表情包,绝不每条文字都跟一个表情。如果不确定要不要发,就不发。',
        '- stickerId 必须从下方【当前可用表情】清单里**逐字复制**,绝对不要自己拼接 stk-XXX 之类的 ID——你想象不到的 ID 一定不存在,用了用户看不到。',
        '',
        '当前可用表情:',
        ...stickers.map((s) => `${s.id}: ${s.description}`),
      );
    }

    return lines.join('\n');
  });
}

/** Test-only: let tests re-run the registration after _resetXxxForTests calls. */
export function _resetXingYuRegistrationForTests(): void {
  registered = false;
}
