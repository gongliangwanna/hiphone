// src/platform/ai/defaultReplyRenderer.ts
/**
 * Default (platform-provided) reply renderer — used whenever an app
 * hasn't registered its own in `replyRendererRegistry`. Produces
 * natural-language text that both humans and the LLM can read, while
 * preserving every tool-type and param value in the rendered output.
 *
 * Rules (M4.2.5 unified shape):
 *   - text (param is string) → `<speaker>: <param>`
 *   - everything else         → `<speaker>: 【<type>】<JSON.stringify(param)>`
 *
 * The fallback branch stringifies non-string params losslessly; stickerId
 * / action params / etc. all survive through to the next prompt.
 *
 * See docs/superpowers/specs/2026-04-20-m4.2.5-unified-tool-wire-format-design.md §8
 */

import { parseReply } from './replyParser';
import type { ReplyRenderer, ReplyRenderContext } from './replyRendererRegistry';

function renderOne(
  item: { type: string; param: unknown },
  ctx: ReplyRenderContext,
): string {
  if (item.type === 'text' && typeof item.param === 'string') {
    return `${ctx.speakerName}: ${item.param}`;
  }
  const paramStr =
    typeof item.param === 'string' ? item.param : JSON.stringify(item.param);
  return `${ctx.speakerName}: 【${item.type}】${paramStr}`;
}

export const defaultReplyRenderer: ReplyRenderer = {
  render(raw, ctx) {
    // Rendering is lenient — accept any type (no knownTypes whitelist).
    const { items, error } = parseReply(raw, new Set());
    if (error !== null || items.length === 0) {
      // Fallback — treat the whole raw string as a single text item so
      // downstream consumers see SOMETHING readable.
      return `${ctx.speakerName}: ${raw}`;
    }
    return items.map((i) => renderOne(i, ctx)).join('\n');
  },
};
