/**
 * Canonical write path — update xingYuDataStore.messages[] AND mirror into
 * characterMemoryStore (with cross-write to AI-AI participants).
 *
 * Every code path that appends to xingYuDataStore.messages[] must call this
 * instead of direct setState, so AI memory stays a lossless mirror of the
 * XingYu UI data in text form.
 *
 * See docs/superpowers/specs/2026-04-19-m4.1-ai-sdk-xingyu-migration-design.md §7
 */

import { getLocationPreview, type Conversation, type Message } from '@/apps/XingYu/data';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useXYNav } from '@/apps/XingYu/xingYuNavStore';
import { ensureSceneMarker } from '@/apps/XingYu/sceneMarker';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useCharacterMemory, type MemorySource } from './characterMemoryStore';
import { buildMemoryEntry, type BuildMemoryContext } from './buildMemoryEntry';

/**
 * Append one message to xingYuDataStore (updating messages[] + the conv's
 * lastMsg / lastTime / unread), and mirror a text derivative into the
 * relevant character's memoryStore. For AI-AI conversations, the memoryStore
 * write fans out to every participant with role flipped from their POV.
 */
export function _appendMessage(msg: Message, source: MemorySource): void {
  // ── 1. xingYuDataStore write ──
  const xy = useXYData.getState();
  const activeConvId = useXYNav.getState().activeChatId;
  useXYData.setState({
    messages: [...xy.messages, msg],
    conversations: xy.conversations.map((c) =>
      c.id === msg.convId
        ? {
            ...c,
            lastMsg: derivePreview(msg),
            lastTime: msg.timestamp,
            unread: nextUnread(msg, c, activeConvId),
          }
        : c,
    ),
  });

  // ── 2. memoryStore write — primary character ──
  const primaryCharId = deriveCharacterIdFromConv(msg.convId);
  if (!primaryCharId) return;

  const conv = useXYData.getState().conversations.find((c) => c.id === msg.convId);

  // 场景标记：仅当确实有 content entry 要落地时才前置一条 [场景] system entry，
  // 避免 buildMemoryEntry 返回 null（如错误占位）时孤零零留下空标记。
  const primaryEntry = buildMemoryEntry(msg, source, buildCtx(primaryCharId));
  if (primaryEntry) {
    if (conv) ensureSceneMarker(primaryCharId, conv);
    useCharacterMemory.getState().append(primaryCharId, primaryEntry);
  }

  // ── 3. AI-AI fan-out 或 群聊 fan-out ──
  if (conv?.aiChatParticipants?.length) {
    for (const otherId of conv.aiChatParticipants) {
      if (otherId === primaryCharId) continue;
      const entryForOther = buildMemoryEntry(msg, source, buildCtx(otherId));
      if (entryForOther) {
        useCharacterMemory.getState().append(otherId, entryForOther);
      }
    }
  } else if (conv?.groupMemberIds?.length) {
    for (const memberId of conv.groupMemberIds) {
      if (memberId === primaryCharId) continue; // primary already written above
      const entryForMember = buildMemoryEntry(msg, source, buildCtx(memberId));
      if (entryForMember) {
        ensureSceneMarker(memberId, conv);
        useCharacterMemory.getState().append(memberId, entryForMember);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function derivePreview(msg: Message): string {
  // Matches the existing per-action convention in xingYuDataStore:
  //   - plain text    → full text (UI truncates on render)
  //   - note share    → "[备忘录] <title>"
  //   - song share    → "[音乐] <title>"
  //   - image         → "[图片]"
  //   - location      → "[位置] <label>"
  //   - sticker       → "[表情]"
  //   - forward       → "[聊天记录：<title>]"
  //   - heartbeat_log → full text
  switch (msg.type) {
    case 'text': {
      if (msg.noteRef) return `[备忘录] ${msg.noteRef.title || '无标题'}`;
      if (msg.songRef) return `[音乐] ${msg.songRef.title}`;
      return msg.text ?? '';
    }
    case 'image':
      return '[图片]';
    case 'location':
      return getLocationPreview(msg.location);
    case 'sticker':
      return '[表情]';
    case 'forward_card':
      return `[聊天记录：${msg.forwardCard.title}]`;
    case 'heartbeat_log':
      return msg.text ?? '';
    default:
      return '';
  }
}

function nextUnread(
  msg: Message,
  conv: Conversation,
  activeConvId: string | null,
): number {
  // User's own send → they're reading; reset unread.
  if (msg.senderId === 'me') return 0;
  // heartbeat_log is a background diary entry, not a "new message" for the user.
  if (msg.type === 'heartbeat_log') return conv.unread;
  // Chat is in-view → reset to 0 (they see the new message immediately).
  if (activeConvId === conv.id) return 0;
  // Otherwise: bump.
  return conv.unread + 1;
}

function deriveCharacterIdFromConv(convId: string): string | null {
  if (convId.startsWith('c-char-')) {
    return convId.slice('c-char-'.length);
  }
  const conv = useXYData.getState().conversations.find((c) => c.id === convId);
  if (conv?.aiChatParticipants?.length) return conv.aiChatParticipants[0]!;
  if (conv?.groupMemberIds?.length) return conv.groupMemberIds[0]!;
  if (conv?.characterId) return conv.characterId;
  return null;
}

function buildCtx(currentCharId: string): BuildMemoryContext {
  const characters = useCharacterStore.getState().characters;
  const persona = usePersonaStore.getState().getActivePersona();
  const userNickname = useXYData.getState().userSettings?.nickname ?? '用户';
  return {
    currentCharId,
    charactersById: new Map(
      characters.map((c) => [c.id, { id: c.id, name: c.name }]),
    ),
    personaName: persona?.name ?? userNickname,
    userNickname,
  };
}
