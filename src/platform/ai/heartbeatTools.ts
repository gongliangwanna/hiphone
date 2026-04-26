/**
 * Heartbeat agent tool registry.
 *
 * Each tool maps to xingYuDataStore mutations. Crucially, `send_message`
 * writes directly to the store instead of calling sendMessage() — which
 * would trigger an AI reply loop.
 */

import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { notesRegistry, type NotesDataState } from '@/apps/Notes/notesDataStore';
import { runAIChat } from './aiChatEngine';
import { _appendMessage } from './memoryWriter';
import type { Message, Moment } from '@/apps/XingYu/data';
import type { StoreApi, UseBoundStore } from 'zustand';

// ---------------------------------------------------------------------------
// UID helper — re-exported from shared utility
// ---------------------------------------------------------------------------

import { uid } from '@/platform/utils/uid';
export { uid } from '@/platform/utils/uid';

// ---------------------------------------------------------------------------
// Rate limiting & short-ID registry (per character per heartbeat session)
// ---------------------------------------------------------------------------

const aiChatUsedThisHeartbeat = new Set<string>();

/** Short-ID → real-ID mappings, keyed by characterId. Reset each heartbeat. */
const momentAliases = new Map<string, Map<string, string>>(); // charId → (m1 → realId)
const characterAliases = new Map<string, Map<string, string>>(); // charId → (c1 → realId)
const noteAliases = new Map<string, Map<string, string>>(); // charId → (n1 → realId)

function getMomentAlias(characterId: string): Map<string, string> {
  let m = momentAliases.get(characterId);
  if (!m) { m = new Map(); momentAliases.set(characterId, m); }
  return m;
}

function getNoteAlias(characterId: string): Map<string, string> {
  let m = noteAliases.get(characterId);
  if (!m) { m = new Map(); noteAliases.set(characterId, m); }
  return m;
}

export function getCharacterAlias(characterId: string): Map<string, string> {
  let m = characterAliases.get(characterId);
  if (!m) { m = new Map(); characterAliases.set(characterId, m); }
  return m;
}

/** Resolve a short alias (m1, c1) or pass through a raw ID unchanged. */
function resolveMomentId(characterId: string, input: string): string {
  return getMomentAlias(characterId).get(input) ?? input;
}
export function resolveCharacterId(characterId: string, input: string): string {
  return getCharacterAlias(characterId).get(input) ?? input;
}

export function resetHeartbeatLimits(characterId: string) {
  aiChatUsedThisHeartbeat.delete(characterId);
  momentAliases.delete(characterId);
  characterAliases.delete(characterId);
  noteAliases.delete(characterId);
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export interface ToolResult {
  observation: string;
  done: boolean;
}

export async function executeHeartbeatTool(
  type: string,
  param: unknown,
  characterId: string,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const store = useHeartbeatStore.getState();
  // Coerce param into a record shape for the existing exec functions.
  // Each exec already defensively reads `String(input.x ?? '')`, so the
  // shape contract stays identical.
  const input: Record<string, unknown> =
    param !== null && typeof param === 'object' && !Array.isArray(param)
      ? (param as Record<string, unknown>)
      : {};

  switch (type) {
    case 'send_message':
      return execSendMessage(input, characterId, store);
    case 'post_moment':
      return execPostMoment(input, characterId);
    case 'view_moments':
      return execViewMoments(input, characterId);
    case 'like_moment':
      return execLikeMoment(input, characterId);
    case 'comment_moment':
      return execCommentMoment(input, characterId);
    case 'view_unread_messages':
      return execViewUnreadMessages(characterId);
    case 'view_unread_interactions':
      return execViewUnreadInteractions(characterId);
    case 'view_user_signature':
      return execViewUserSignature();
    case 'view_user_signature_history':
      return execViewUserSignatureHistory();
    case 'update_signature':
      return execUpdateSignature(input, characterId);
    case 'view_notes':
      return execViewNotes(input, characterId);
    case 'create_note':
      return execCreateNote(input, characterId);
    case 'view_characters':
      return execViewCharacters(characterId);
    case 'chat_with_character':
      return execChatWithCharacter(input, characterId, signal);
    case 'done':
      return { observation: '心跳结束。', done: true };
    default:
      return { observation: `未知工具: ${type}`, done: false };
  }
}

// ---------------------------------------------------------------------------
// Individual tool implementations
// ---------------------------------------------------------------------------

function execSendMessage(
  input: Record<string, unknown>,
  characterId: string,
  _store: ReturnType<typeof useHeartbeatStore.getState>,
): ToolResult {
  const text = String(input.text ?? '').trim();
  if (!text) {
    return { observation: '消息内容不能为空。', done: false };
  }

  const convId = `c-char-${characterId}`;
  const senderId = `char-${characterId}`;
  const now = Date.now();

  const dataState = useXYData.getState();
  let conv = dataState.conversations.find((c) => c.id === convId);

  // Ensure conversation exists
  if (!conv) {
    const character = useCharacterStore.getState().characters.find((c) => c.id === characterId);
    if (!character) {
      return { observation: '找不到对应角色。', done: false };
    }
    conv = {
      id: convId,
      idolId: senderId,
      characterId,
      lastMsg: '',
      lastTime: now,
      unread: 0,
    };
    useXYData.setState({
      conversations: [conv, ...dataState.conversations],
    });
  }

  const msg: Message = {
    id: uid(),
    convId,
    senderId,
    type: 'text',
    text,
    timestamp: now,
    proactive: true,
  };

  _appendMessage(msg, 'heartbeat');

  useHeartbeatStore.getState().pushLog({
    characterId,
    action: 'send_message',
    detail: text.slice(0, 40),
  });

  return { observation: '消息已发送。', done: false };
}

function execPostMoment(
  input: Record<string, unknown>,
  characterId: string,
): ToolResult {
  const text = String(input.text ?? '').trim();
  if (!text) {
    return { observation: '动态内容不能为空。', done: false };
  }

  const moment: Moment = {
    id: uid(),
    idolId: `char-${characterId}`,
    text,
    likedBy: [],
    timestamp: Date.now(),
    comments: [],
  };

  const currentState = useXYData.getState();
  useXYData.setState({
    moments: [moment, ...currentState.moments],
  });

  useHeartbeatStore.getState().pushLog({
    characterId,
    action: 'post_moment',
    detail: text.slice(0, 40),
  });

  return { observation: '动态已发布。', done: false };
}

const PAGE_SIZE = 5;

function execViewMoments(input: Record<string, unknown>, characterId: string): ToolResult {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const allMoments = useXYData.getState().moments;
  const totalPages = Math.max(1, Math.ceil(allMoments.length / PAGE_SIZE));

  if (allMoments.length === 0) {
    return { observation: '暂无星球动态。', done: false };
  }

  const start = (page - 1) * PAGE_SIZE;
  const slice = allMoments.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    return { observation: `第${page}页没有更多动态了（共${totalPages}页）。`, done: false };
  }

  const userSettings = useXYData.getState().userSettings;
  const characters = useCharacterStore.getState().characters;
  const aliases = getMomentAlias(characterId);

  const nameOf = (id: string): string => {
    if (id === 'me') return userSettings.nickname || '用户';
    if (id.startsWith('char-')) {
      const char = characters.find((c) => c.id === id.slice(5));
      return char?.name ?? '???';
    }
    return id;
  };

  const lines = slice.map((m, i) => {
    // Register short alias: m1, m2, ...
    const alias = `m${start + i + 1}`;
    aliases.set(alias, m.id);

    const authorName = nameOf(m.idolId);
    const likedStr = m.likedBy.includes(`char-${characterId}`) ? '（你已赞）' : '';
    const header = `[${alias}] [${authorName}] ${m.text.slice(0, 80)} — ${m.likedBy.length}赞${likedStr}, ${m.comments.length}评论`;

    if (m.comments.length === 0) return header;

    const commentLines = m.comments.slice(-5).map(
      (c) => `  [评论] ${nameOf(c.userId)}: ${c.text.slice(0, 60)}`,
    );
    if (m.comments.length > 5) {
      commentLines.unshift(`  ...还有${m.comments.length - 5}条更早的评论`);
    }
    return [header, ...commentLines].join('\n');
  });

  lines.push(`--- 第${page}/${totalPages}页，共${allMoments.length}条 ---`);
  lines.push('提示：用 m1、m2… 作为 momentId 操作对应动态');

  return { observation: lines.join('\n'), done: false };
}

function execLikeMoment(input: Record<string, unknown>, characterId: string): ToolResult {
  const rawId = String(input.momentId ?? '').trim();
  if (!rawId) {
    return { observation: '请提供 momentId（如 m1）。', done: false };
  }
  const momentId = resolveMomentId(characterId, rawId);

  const moment = useXYData.getState().moments.find((m) => m.id === momentId);
  if (!moment) {
    return { observation: `找不到动态 ${rawId}。先用 view_moments 查看。`, done: false };
  }
  const charUserId = `char-${characterId}`;
  if (moment.likedBy.includes(charUserId)) {
    return { observation: '已经点过赞了。', done: false };
  }

  useXYData.getState().toggleLike(momentId, charUserId);

  return { observation: '已点赞。', done: false };
}

function execCommentMoment(
  input: Record<string, unknown>,
  characterId: string,
): ToolResult {
  const rawId = String(input.momentId ?? '').trim();
  const text = String(input.text ?? '').trim();

  if (!rawId) {
    return { observation: '请提供 momentId（如 m1）。', done: false };
  }
  if (!text) {
    return { observation: '评论内容不能为空。', done: false };
  }
  const momentId = resolveMomentId(characterId, rawId);

  const moment = useXYData.getState().moments.find((m) => m.id === momentId);
  if (!moment) {
    return { observation: `找不到动态 ${momentId}。`, done: false };
  }

  // Write comment via centralized addComment (also generates interaction records)
  const commentUserId = `char-${characterId}`;
  useXYData.getState().addComment(momentId, text, commentUserId);

  useHeartbeatStore.getState().pushLog({
    characterId,
    action: 'comment_moment',
    detail: text.slice(0, 40),
  });

  return { observation: '评论已发布。', done: false };
}

function execViewUserSignature(): ToolResult {
  const { bio, nickname } = useXYData.getState().userSettings;
  if (bio) {
    return { observation: `${nickname}的个性签名：「${bio}」`, done: false };
  }
  return { observation: `${nickname}还没有设置个性签名。`, done: false };
}

function execViewUserSignatureHistory(): ToolResult {
  const { userSettings, userSignatureHistory } = useXYData.getState();
  if (userSignatureHistory.length === 0) {
    return { observation: `${userSettings.nickname}没有历史签名记录。`, done: false };
  }

  const lines = userSignatureHistory.slice(0, 10).map((record) => {
    const d = new Date(record.timestamp);
    const mo = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `「${record.text}」 (${mo}/${dd} ${hh}:${mm})`;
  });

  lines.unshift(`${userSettings.nickname}的历史签名（最近${lines.length}条）：`);
  return { observation: lines.join('\n'), done: false };
}

function execUpdateSignature(
  input: Record<string, unknown>,
  characterId: string,
): ToolResult {
  const text = String(input.text ?? '').trim();
  if (!text) {
    return { observation: '签名内容不能为空。', done: false };
  }

  useXYData.getState().updateCharacterSignature(characterId, text);

  useHeartbeatStore.getState().pushLog({
    characterId,
    action: 'update_signature',
    detail: text.slice(0, 40),
  });

  return { observation: '签名已更新。', done: false };
}

// ---------------------------------------------------------------------------
// Hydration helper for lazily-created entity stores
// ---------------------------------------------------------------------------

async function ensureHydrated(store: UseBoundStore<StoreApi<NotesDataState>>) {
  if (!(store as unknown as { persist: { hasHydrated: () => boolean } }).persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = (store as unknown as { persist: { onFinishHydration: (cb: () => void) => () => void } }).persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Notes tools
// ---------------------------------------------------------------------------

async function execViewNotes(input: Record<string, unknown>, characterId: string): Promise<ToolResult> {
  const store = notesRegistry.getStore(characterId);
  await ensureHydrated(store);

  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const allNotes = [...store.getState().notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const totalPages = Math.max(1, Math.ceil(allNotes.length / PAGE_SIZE));

  if (allNotes.length === 0) {
    return { observation: '你还没有写过备忘录。', done: false };
  }

  const start = (page - 1) * PAGE_SIZE;
  const slice = allNotes.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    return { observation: `第${page}页没有更多备忘录了（共${totalPages}页）。`, done: false };
  }

  const aliases = getNoteAlias(characterId);
  const lines = slice.map((n, i) => {
    const alias = `n${start + i + 1}`;
    aliases.set(alias, n.id);
    const d = new Date(n.updatedAt);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    return `[${alias}] ${n.title || '无标题'} — ${n.body.slice(0, 60)} (${dateStr})`;
  });

  lines.push(`--- 第${page}/${totalPages}页，共${allNotes.length}条 ---`);

  return { observation: lines.join('\n'), done: false };
}

async function execCreateNote(input: Record<string, unknown>, characterId: string): Promise<ToolResult> {
  const title = String(input.title ?? '').trim();
  const body = String(input.body ?? '').trim();
  if (!title && !body) {
    return { observation: '标题和内容不能都为空。', done: false };
  }

  const store = notesRegistry.getStore(characterId);
  await ensureHydrated(store);

  store.getState().addNote(title, body);

  useHeartbeatStore.getState().pushLog({
    characterId,
    action: 'create_note',
    detail: (title || body).slice(0, 40),
  });

  return { observation: '备忘录已创建。', done: false };
}

function execViewCharacters(selfCharacterId: string): ToolResult {
  const characters = useCharacterStore.getState().characters;
  const others = characters.filter((c) => c.id !== selfCharacterId);

  if (others.length === 0) {
    return { observation: '目前没有其他角色。', done: false };
  }

  const aliases = getCharacterAlias(selfCharacterId);
  const lines = others.map((c, i) => {
    const alias = `c${i + 1}`;
    aliases.set(alias, c.id);
    const sig = useXYData.getState().characterSignatures[c.id]?.current;
    const sigStr = sig ? ` 签名：「${sig}」` : '';
    return `- [${alias}] ${c.name}${sigStr}`;
  });

  lines.push('提示：用 c1、c2… 作为 characterId 操作对应角色');

  return { observation: `可以聊天的角色：\n${lines.join('\n')}`, done: false };
}

async function execChatWithCharacter(
  input: Record<string, unknown>,
  selfCharacterId: string,
  signal?: AbortSignal,
): Promise<ToolResult> {
  if (aiChatUsedThisHeartbeat.has(selfCharacterId)) {
    return { observation: '本次心跳已经和角色聊过天了，不能再发起。', done: false };
  }

  const rawId = String(input.characterId ?? '').trim();
  const message = String(input.message ?? '').trim();

  if (!rawId) {
    return { observation: '请提供目标角色（如 c1）。先用 view_characters 查看。', done: false };
  }
  const targetId = resolveCharacterId(selfCharacterId, rawId);
  if (!message) {
    return { observation: '请提供你想说的话。', done: false };
  }
  if (targetId === selfCharacterId) {
    return { observation: '不能和自己聊天。', done: false };
  }

  const target = useCharacterStore.getState().characters.find((c) => c.id === targetId);
  if (!target) {
    return { observation: `找不到角色 ${targetId}。用 view_characters 查看可用角色。`, done: false };
  }

  aiChatUsedThisHeartbeat.add(selfCharacterId);

  useHeartbeatStore.getState().pushLog({
    characterId: selfCharacterId,
    action: 'chat_with_character',
    detail: `和${target.name}聊天：${message.slice(0, 30)}`,
  });

  let result;
  try {
    result = await runAIChat({
      initiatorCharId: selfCharacterId,
      targetCharId: targetId,
      openingMessage: message,
      maxRounds: useHeartbeatStore.getState().getCharacterConfig(selfCharacterId).aiChatMaxRounds,
      signal: signal ?? new AbortController().signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return { observation: '聊天被中断。', done: false };
    }
    return { observation: `聊天出错: ${e instanceof Error ? e.message : String(e)}`, done: false };
  }

  if (result.messages.length === 0) {
    return { observation: `和${target.name}的聊天没有产生对话。`, done: false };
  }

  const transcript = result.messages
    .map((m) => `${m.senderName}：${m.text}`)
    .join('\n');

  return { observation: `和${target.name}的聊天记录：\n${transcript}`, done: false };
}

// ---------------------------------------------------------------------------
// Unread messages & interactions tools
// ---------------------------------------------------------------------------

function execViewUnreadMessages(characterId: string): ToolResult {
  const state = useXYData.getState();
  const ownConvId = `c-char-${characterId}`;
  const lastReadTs = state.characterLastReadMsgTs[characterId] ?? 0;

  const unreadMsgs = state.messages
    .filter(
      (m) =>
        m.convId === ownConvId &&
        m.type !== 'heartbeat_log' &&
        m.senderId === 'me' &&
        m.timestamp > lastReadTs,
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const userName = state.userSettings.nickname || '用户';

  // Mark as read
  useXYData.getState().markCharacterMsgRead(characterId);

  if (unreadMsgs.length === 0) {
    return { observation: '没有未读消息。', done: false };
  }

  const preview = unreadMsgs
    .slice(-5)
    .map((m) => `  「${(m.type === 'text' || m.type === 'heartbeat_log') ? m.text.slice(0, 60) : '[非文本]'}」`)
    .join('\n');

  return {
    observation: `${userName}发了${unreadMsgs.length}条未读消息：\n${preview}`,
    done: false,
  };
}

function execViewUnreadInteractions(characterId: string): ToolResult {
  const state = useXYData.getState();
  const characters = useCharacterStore.getState().characters;
  const charSenderId = `char-${characterId}`;
  const seenCount = state.characterSeenInteractionCount[characterId] ?? 0;

  // Compute all interactions on this character's moments (likes + comments from others)
  const allInteractions: { type: 'like' | 'comment'; userId: string; momentText: string; commentText?: string }[] = [];

  for (const mo of state.moments) {
    if (mo.idolId !== charSenderId) continue;
    for (const likerId of mo.likedBy) {
      if (likerId !== charSenderId) {
        allInteractions.push({ type: 'like', userId: likerId, momentText: mo.text.slice(0, 30) });
      }
    }
    for (const c of mo.comments) {
      if (c.userId !== charSenderId) {
        allInteractions.push({ type: 'comment', userId: c.userId, momentText: mo.text.slice(0, 30), commentText: c.text });
      }
    }
  }

  const totalCount = allInteractions.length;
  const newCount = totalCount - seenCount;

  // Mark all as read
  useXYData.getState().markCharacterInteractionRead(characterId, totalCount);

  if (newCount <= 0) {
    return { observation: '没有新的互动通知。', done: false };
  }

  const nameOf = (userId: string): string => {
    if (userId === 'me') return state.userSettings.nickname || '用户';
    if (userId.startsWith('char-')) {
      const char = characters.find((c) => c.id === userId.slice(5));
      return char?.name ?? '???';
    }
    return userId;
  };

  // Show the newest interactions (last N items are the "new" ones)
  const newItems = allInteractions.slice(-newCount);
  const lines = newItems.slice(0, 10).map((i) => {
    const who = nameOf(i.userId);
    if (i.type === 'like') {
      return `[赞] ${who} 赞了你的动态「${i.momentText}」`;
    }
    return `[评论] ${who} 评论了你的动态「${i.momentText}」：「${i.commentText?.slice(0, 40) ?? ''}」`;
  });

  return { observation: `${newCount}条新互动：\n${lines.join('\n')}`, done: false };
}
