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
import { runAIChat } from './aiChatEngine';
import type { Message, Moment } from '@/apps/XingYu/data';

// ---------------------------------------------------------------------------
// UID helper (same as xingYuDataStore)
// ---------------------------------------------------------------------------

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch { /* fall through */ }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Tool descriptions (injected into system prompt)
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  params: string;
}

/**
 * Build tool definitions with dynamic user name.
 * The user name makes send_message clearly distinct from chat_with_character.
 */
export function buildHeartbeatTools(userName: string): ToolDef[] {
  return [
    {
      name: 'send_message',
      description: `在你和${userName}的私聊中发一条消息（注意：这是给${userName}发消息，不是给其他角色）`,
      params: '{"text": "消息内容"}',
    },
    {
      name: 'post_moment',
      description: '发一条星球动态（朋友圈）',
      params: '{"text": "动态内容"}',
    },
    {
      name: 'view_moments',
      description: '分页查看星球动态，每页5条',
      params: '{"page": 1}',
    },
    {
      name: 'like_moment',
      description: '给某条动态点赞（先 view_moments 获取编号）',
      params: '{"momentId": "m1"}',
    },
    {
      name: 'comment_moment',
      description: '给某条动态评论（先 view_moments 获取编号）',
      params: '{"momentId": "m1", "text": "评论内容"}',
    },
    {
      name: 'view_user_signature',
      description: `查看${userName}当前的个性签名`,
      params: '{}',
    },
    {
      name: 'view_user_signature_history',
      description: `查看${userName}的历史个性签名`,
      params: '{}',
    },
    {
      name: 'update_signature',
      description: '修改自己的个性签名',
      params: '{"text": "新签名"}',
    },
    {
      name: 'view_characters',
      description: '查看可以聊天的其他角色列表',
      params: '{}',
    },
    {
      name: 'chat_with_character',
      description: '和另一个AI角色私聊（想找别的角色说话就用这个，不是send_message）',
      params: '{"characterId": "c1", "message": "你想对TA说的话"}',
    },
    {
      name: 'done',
      description: '结束本次心跳，不再执行其他操作',
      params: '{}',
    },
  ];
}

/** Static reference for backward compat (uses generic "用户") */
export const HEARTBEAT_TOOLS: ToolDef[] = buildHeartbeatTools('用户');

// ---------------------------------------------------------------------------
// Rate limiting & short-ID registry (per character per heartbeat session)
// ---------------------------------------------------------------------------

const aiChatUsedThisHeartbeat = new Set<string>();

/** Short-ID → real-ID mappings, keyed by characterId. Reset each heartbeat. */
const momentAliases = new Map<string, Map<string, string>>(); // charId → (m1 → realId)
const characterAliases = new Map<string, Map<string, string>>(); // charId → (c1 → realId)

function getMomentAlias(characterId: string): Map<string, string> {
  let m = momentAliases.get(characterId);
  if (!m) { m = new Map(); momentAliases.set(characterId, m); }
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
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export interface ToolResult {
  observation: string;
  done: boolean;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  characterId: string,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const store = useHeartbeatStore.getState();

  switch (toolName) {
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
    case 'view_user_signature':
      return execViewUserSignature();
    case 'view_user_signature_history':
      return execViewUserSignatureHistory();
    case 'update_signature':
      return execUpdateSignature(input, characterId);
    case 'view_characters':
      return execViewCharacters(characterId);
    case 'chat_with_character':
      return execChatWithCharacter(input, characterId, signal);
    case 'done':
      return { observation: '心跳结束。', done: true };
    default:
      return { observation: `未知工具: ${toolName}`, done: false };
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

  const currentState = useXYData.getState();
  useXYData.setState({
    messages: [...currentState.messages, msg],
    conversations: currentState.conversations.map((c) =>
      c.id === convId
        ? { ...c, lastMsg: text.slice(0, 60), lastTime: now, unread: c.unread + 1 }
        : c,
    ),
  });

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
    likes: 0,
    liked: false,
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
    const likedStr = m.liked ? '（你已赞）' : '';
    const header = `[${alias}] [${authorName}] ${m.text.slice(0, 80)} — ${m.likes}赞${likedStr}, ${m.comments.length}评论`;

    if (m.comments.length === 0) return header;

    const commentLines = m.comments.slice(-5).map(
      (c) => `  💬 ${nameOf(c.userId)}: ${c.text.slice(0, 60)}`,
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
  if (moment.liked) {
    return { observation: '已经点过赞了。', done: false };
  }

  useXYData.getState().toggleLike(momentId);

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

  // Write comment with character userId
  const commentUserId = `char-${characterId}`;
  const currentState = useXYData.getState();
  useXYData.setState({
    moments: currentState.moments.map((m) =>
      m.id === momentId
        ? { ...m, comments: [...m.comments, { userId: commentUserId, text }] }
        : m,
    ),
  });

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
