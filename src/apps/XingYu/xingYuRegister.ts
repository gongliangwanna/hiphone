/**
 * XingYu's AI-integration bootstrap.
 *
 * Registers the app's tools / reply renderer / app-system-prompt under
 * the appId "xingyu". Called once from xingYuDataStore at module import
 * time. Idempotent: multiple invocations are safe (registry Map.set
 * replaces rather than appends).
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §9
 */

import { registerTools } from '@/platform/ai/toolRegistry';
import { registerReplyRenderer } from '@/platform/ai/replyRendererRegistry';
import { registerAppSystemPrompt } from '@/platform/ai/appSystemPromptRegistry';
import { defaultXingYuRenderer } from '@/platform/ai/defaultXingYuRenderer';
import { useStickerStore } from './stickerStore';

export const XINGYU_APP_ID = 'xingyu';

let registered = false;

export function registerXingYuAi(): void {
  if (registered) return;
  registered = true;

  registerTools(XINGYU_APP_ID, [
    {
      name: 'sticker',
      description:
        '发一个表情包。stickerId 必须从 [当前任务] 中列出的可用表情里选，不要编造。content 是该表情的简短描述文案，用来让对话上下文仍然能读懂你发了什么表情。',
      parameters: { stickerId: 'string', content: 'string' },
    },
    {
      name: 'update_signature',
      description:
        '修改自己的个性签名。签名会显示在星球主页上。不要频繁更换，只有在心情或状态明显变化时才调用。',
      parameters: { text: 'string' },
    },
  ]);

  registerReplyRenderer(XINGYU_APP_ID, defaultXingYuRenderer);

  registerAppSystemPrompt(XINGYU_APP_ID, () => {
    const stickers = useStickerStore
      .getState()
      .packs.flatMap((pack) =>
        pack.stickers.map((s) => ({ id: s.id, description: s.description })),
      );
    if (stickers.length === 0) return '';
    return (
      '当前可用表情：\n' +
      stickers.map((s) => `${s.id}: ${s.description}`).join('\n')
    );
  });
}

/** Test-only: let tests re-run the registration after _resetXxxForTests calls. */
export function _resetXingYuRegistrationForTests(): void {
  registered = false;
}
