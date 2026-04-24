/**
 * Convert one XingYu rich Message into the AI-memory representation.
 *
 * Pure function — no store reads. Caller passes the resolution context
 * (character map, persona name, nickname).
 *
 * Returns null to skip the message (e.g. error placeholders).
 *
 * Mirrors the prior runtime behaviour of `messageToContent` +
 * `collectCharacterHistory.quoteRef/forward_card` expansion; everything
 * is now done at write time so memoryStore holds the canonical text.
 *
 * See docs/superpowers/specs/2026-04-19-m4.1-ai-sdk-xingyu-migration-design.md §6
 */

import type { Message } from '@/apps/XingYu/data';
import type {
  MemoryEntry,
  MemorySource,
  MemoryRole,
} from './characterMemoryStore';
import { stripCharPrefix } from '@/platform/utils/characterId';

export interface BuildMemoryContext {
  /** The character whose memoryStore receives this entry; defines role mapping. */
  currentCharId: string;
  /** All characters known to the platform (used for quoteRef / forward sender names). */
  charactersById: Map<string, { id: string; name: string }>;
  /** Active persona display name (used when senderId === 'me'). */
  personaName: string;
  /** User's XingYu nickname (fallback when persona is unset). */
  userNickname: string;
}

type BuildResult = Omit<MemoryEntry, 'id' | 'characterId' | 'createdAt'>;

export function buildMemoryEntry(
  msg: Message,
  source: MemorySource,
  ctx: BuildMemoryContext,
): BuildResult | null {
  const { role, speakerId } = resolveSpeaker(msg.senderId, ctx.currentCharId);
  const content = messageToRawContent(msg, ctx);
  if (content === null) return null;
  return { role, speakerId, content, source };
}

function resolveSpeaker(
  senderId: string,
  currentCharId: string,
): { role: MemoryRole; speakerId: string } {
  if (senderId === 'me') {
    return { role: 'user', speakerId: 'me' };
  }
  // The codebase inconsistently uses bare (e.g. 'soren') and prefixed
  // ('char-soren') character IDs across different stores. Normalize both
  // sides before comparison. speakerId preserves senderId verbatim so the
  // render layer can look up display names via its own convention.
  if (stripCharPrefix(senderId) === stripCharPrefix(currentCharId)) {
    return { role: 'assistant', speakerId: senderId };
  }
  return { role: 'user', speakerId: senderId };
}

function messageToRawContent(msg: Message, ctx: BuildMemoryContext): string | null {
  switch (msg.type) {
    case 'text': {
      if (msg.text?.startsWith('[AI 回复失败]')) return null;
      if (msg.text?.startsWith('[未配置 AI 服务]')) return null;

      const baseText = msg.text ?? '';
      if (msg.quoteRef) {
        const quotedName = resolveQuoteSenderName(msg.quoteRef.senderId, ctx);
        return `[引用 ${quotedName}：${msg.quoteRef.preview}] ${baseText}`;
      }
      return baseText;
    }
    case 'image':
      return `[图片 ${msg.imageUrl}]`;
    case 'sticker':
      return msg.stickerDesc ? `[表情：${msg.stickerDesc}]` : '[表情]';
    case 'forward_card': {
      const lines = msg.forwardCard.messages.map((fm) => {
        const body =
          fm.type === 'image' ? '[图片]' :
          fm.type === 'sticker' ? '[表情]' :
          (fm.text ?? '');
        return `- ${fm.senderName}：${body}`;
      });
      return `[转发的聊天记录：${msg.forwardCard.title}]\n${lines.join('\n')}\n[/转发结束]`;
    }
    case 'heartbeat_log':
      return msg.text ? `[自主活动记录]\n${msg.text}` : null;
    default:
      return null;
  }
}

function resolveQuoteSenderName(senderId: string, ctx: BuildMemoryContext): string {
  if (senderId === 'me') {
    return ctx.personaName || ctx.userNickname || '用户';
  }
  // charactersById may be keyed by full 'char-xxx' (if Character.id is that
  // shape) or by the bare 'xxx' form. Check both to tolerate either convention.
  const byFull = ctx.charactersById.get(senderId);
  if (byFull) return byFull.name;
  const byStripped = ctx.charactersById.get(stripCharPrefix(senderId));
  if (byStripped) return byStripped.name;
  return senderId;
}
