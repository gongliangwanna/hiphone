/**
 * Lossless default reply renderer — used whenever an app hasn't
 * registered its own in replyRendererRegistry. Produces natural-language
 * text that a human + the LLM can both read, while preserving every
 * decision-relevant identifier (stickerId, action params).
 *
 * Rendering rules (spec §2 + D2):
 *
 *   text       → "<speaker>: <content>"
 *   action     → "<speaker>: 【<name>】<k=v> <k=v> …"
 *   sticker*   → "<speaker>: [表情 <stickerId>: <content>]"
 *   signature* → "<speaker>: [更新签名: <text>]"
 *
 *   * legacy item types, kept during XingYu's transition to tool-based actions
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §2
 */

import { parseReply, type ReplyItem } from './replyParser';
import type { ReplyRenderer, ReplyRenderContext } from './replyRendererRegistry';

function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
}

function renderOne(item: ReplyItem, ctx: ReplyRenderContext): string {
  if (item.type === 'text') {
    return `${ctx.speakerName}: ${item.content}`;
  }
  if (item.type === 'action') {
    const paramStr = formatParams(item.params);
    const tail = paramStr ? `${paramStr}` : '';
    return tail
      ? `${ctx.speakerName}: 【${item.name}】${tail}`
      : `${ctx.speakerName}: 【${item.name}】`;
  }
  if (item.type === 'sticker') {
    return `${ctx.speakerName}: [表情 ${item.stickerId}: ${item.content}]`;
  }
  // signature
  return `${ctx.speakerName}: [更新签名: ${item.text}]`;
}

export const defaultXingYuRenderer: ReplyRenderer = {
  render(raw, ctx) {
    const items = parseReply(raw);
    return items.map((i) => renderOne(i, ctx)).join('\n');
  },
};
