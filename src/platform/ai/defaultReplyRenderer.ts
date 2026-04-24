// src/platform/ai/defaultReplyRenderer.ts
/**
 * Default (platform-provided) reply renderer — used whenever an app
 * hasn't registered its own in `replyRendererRegistry`. Produces
 * natural-language content that both humans and the LLM can read, while
 * preserving every tool-type and param value in the rendered output.
 *
 * Rules (M4.2.5 unified shape):
 *   - text (param is string)  → `<param>`
 *   - sticker (param is obj)  → `发送表情包 "<content>" (stickerId=<id>)`
 *   - everything else         → `【<type>】<JSON.stringify(param)>`
 *
 * The renderer returns content ONLY — speaker-name prefixing is the
 * transcript layer's job (see `renderTranscriptLine` in promptAssembly).
 * Baking `<speaker>:` in here caused double-labelling like
 * `[23:16] 我：新角色: 晚上好` once the transcript added its own prefix.
 *
 * The fallback branch stringifies non-string params losslessly; stickerId
 * / action params / etc. all survive through to the next prompt.
 *
 * See docs/superpowers/specs/2026-04-20-m4.2.5-unified-tool-wire-format-design.md §8
 */

import { parseReply } from './replyParser';
import type { ReplyRenderer } from './replyRendererRegistry';

function renderOne(item: { type: string; param: unknown }): string {
  if (item.type === 'text' && typeof item.param === 'string') {
    return item.param;
  }
  if (
    item.type === 'sticker' &&
    item.param !== null &&
    typeof item.param === 'object'
  ) {
    const p = item.param as { stickerId?: unknown; content?: unknown };
    const sid = typeof p.stickerId === 'string' ? p.stickerId : '?';
    const desc = typeof p.content === 'string' && p.content ? p.content : '表情';
    return `发送表情包 "${desc}" (stickerId=${sid})`;
  }
  const paramStr =
    typeof item.param === 'string' ? item.param : JSON.stringify(item.param);
  return `【${item.type}】${paramStr}`;
}

export const defaultReplyRenderer: ReplyRenderer = {
  render(raw) {
    // Rendering is lenient — accept any type (no knownTypes whitelist).
    const { items, error } = parseReply(raw, new Set());
    if (error !== null || items.length === 0) {
      // Fallback — treat the whole raw string as the rendered content so
      // downstream consumers see SOMETHING readable.
      return raw;
    }
    return items.map((i) => renderOne(i)).join('\n');
  },
};
