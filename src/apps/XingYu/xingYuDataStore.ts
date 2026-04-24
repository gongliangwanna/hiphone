import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { loadAllMessages, loadAllMoments } from '@/platform/storage/idbRecordStorage';
import { startXYDataSync } from '@/platform/storage/zustandIdbSync';
import {
  loadCharacterMemoryFromIdb,
  startCharacterMemoryIdbSync,
  useCharacterMemory,
} from '@/platform/ai/characterMemoryStore';
import { installAutoCompression } from '@/platform/ai/characterMemoryCompression';
import { _appendMessage } from '@/platform/ai/memoryWriter';
import { uid } from '@/platform/utils/uid';
import { stripCharPrefix } from '@/platform/utils/characterId';
import type {
  Conversation,
  Favorite,
  ForwardCardMessage,
  ForwardedMsg,
  Message,
  Moment,
  MomentInteraction,
  QuoteRef,
  TextMessage,
} from './data';
import {
  SEED_CONVS,
  SEED_MSGS,
  SEED_MOMENTS,
  IDOL_REPLY_POOL,
  getIdol,
} from './data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { filterReply } from '@/platform/ai/replyFilters';
import {
  chatWithCharacter,
  ensureAppSwitchMarker,
  type ChatReply,
  type ChatSession,
} from '@/platform/userApp/sdk/ai';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import { useXYNav } from './xingYuNavStore';
import { useStickerStore } from './stickerStore';
import { registerXingYuAi, XINGYU_APP_ID } from './xingYuRegister';

// Idempotent: fires on first module load so the three AI registries
// know about XingYu before any `scheduleAICharacterReply` runs. Safe to
// call repeatedly.
registerXingYuAi();

/**
 * 某 conv 当前是否正被用户"看着":
 * 如果是,回复到达时就不要 unread++,否则"边看边红点"很蠢。
 * navStore 只依赖 zustand,不会反向 import dataStore,无循环依赖风险。
 */
function isChatActive(convId: string): boolean {
  return useXYNav.getState().activeChatId === convId;
}

/**
 * Fire `[上下文切换] 用户打开了 可爱信` into the character's memory BEFORE
 * the user turn is written. XingYu writes user memory entries inline via
 * `_appendMessage`, then creates the ChatSession lazily inside
 * `scheduleAICharacterReply` — if we relied on `chatWithCharacter`'s own
 * marker injection, the marker would land AFTER the user entry. This
 * helper restores the expected "system event → user turn" order.
 *
 * Idempotent (ensureAppSwitchMarker is a no-op when lastActiveAppId ===
 * appId). Safe to invoke on every send action.
 */
function fireAppSwitchMarker(convId: string, get: () => XingYuDataState): void {
  const conv = get().conversations.find((c) => c.id === convId);
  if (conv?.characterId) {
    ensureAppSwitchMarker(conv.characterId, XINGYU_APP_ID);
  }
}


/** 根据成员 id 列表派生群名（取前3个成员名；超过3人附加「等 N 人」后缀） */
function deriveGroupName(memberIds: string[]): string {
  const chars = useCharacterStore.getState().characters;
  const names = memberIds
    .map((id) => chars.find((c) => c.id === id)?.name ?? '未知')
    .filter(Boolean);
  if (names.length === 0) return '新群聊';
  const head = names.slice(0, 3).join('、');
  if (memberIds.length > 3) return `${head} 等 ${memberIds.length} 人`;
  return head;
}

/* ── Auto-reply timers (module-level, not serializable) ── */
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();
/* ── In-flight AI sessions (+ their abort controllers), keyed by convId ── */
interface XingYuAiSession {
  session: ChatSession;
  controller: AbortController;
}
const aiSessions = new Map<string, XingYuAiSession>();

// uid() imported from @/platform/utils/uid

export interface UserSettings {
  nickname: string;
  bio: string;
  accentColor: string;
  avatarUrl: string;
  coverUrl: string;
}

export interface SignatureRecord {
  text: string;
  timestamp: number;
}

export interface CharacterSignatureData {
  current: string;
  history: SignatureRecord[];
}

interface XingYuDataState {
  conversations: Conversation[];
  messages: Message[];
  moments: Moment[];
  userSettings: UserSettings;
  /** 角色个性签名，key 为 characterId */
  characterSignatures: Record<string, CharacterSignatureData>;
  /** 用户个性签名历史 */
  userSignatureHistory: SignatureRecord[];
  /** 朋友圈互动通知 — 仅收录别人给"我"(player)的点赞/评论 */
  interactions: MomentInteraction[];
  /** 玩家未读互动数 */
  unreadInteractionCount: number;
  /** AI 角色上次查看消息的时间戳, key = characterId */
  characterLastReadMsgTs: Record<string, number>;
  /** AI 角色已看过的互动总数, key = characterId */
  characterSeenInteractionCount: Record<string, number>;
  /** 用户收藏的消息 */
  favorites: Favorite[];

  sendMessage: (convId: string, text: string, quoteRef?: QuoteRef) => void;
  sendNoteMessage: (convId: string, noteRef: { noteId: string; title: string; body: string }) => void;
  sendSongMessage: (convId: string, songRef: { songId: string; title: string; artist: string; artworkUrl: string }, lyricsText?: string) => void;
  sendImageMessage: (convId: string, imageUrl: string) => void;
  sendStickerMessage: (convId: string, stickerUrl: string, stickerDesc: string) => void;
  markRead: (convId: string) => void;
  /**
   * 从信箱里删除一条会话: 清掉 conv + 其所有 messages,
   * 并中断正在进行的 AI 流 / 取消待发的 mock 回复 timer。
   */
  deleteConversation: (convId: string) => void;
  toggleLike: (momentId: string, userId?: string) => void;
  addMoment: (text: string, imageUrl?: string) => void;
  addComment: (momentId: string, text: string, userId?: string) => void;
  markInteractionsRead: () => void;
  markCharacterMsgRead: (characterId: string) => void;
  markCharacterInteractionRead: (characterId: string, count: number) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  /** 更新角色个性签名（AI 调用或手动） */
  updateCharacterSignature: (characterId: string, text: string) => void;
  /**
   * 确保指定 character 的会话存在,不存在则创建并插入 firstMessage。
   * 返回 convId,供导航跳转使用。
   */
  ensureCharacterConversation: (characterId: string) => string;
  /**
   * 确保指定 mock idol 的会话存在,不存在则在信箱顶部新建一条空会话。
   * 用于通讯录点开旧 idol 时,即使该 conv 曾被删除也能重新出现。
   * 返回 convId,供导航跳转使用。
   */
  ensureIdolConversation: (idolId: string) => string;
  /** 更新单个会话的设置（背景、备注名等） */
  updateConversationSettings: (convId: string, patch: Partial<Pick<Conversation, 'backgroundUrl' | 'remarkName'>>) => void;
  /** 创建用户自建群聊（裸 characterId 数组；无需传群名，自动派生），返回 convId */
  createGroupConversation: (memberIds: string[]) => string;
  /** 更新群头像 / 公告 / 名称（任意子集） */
  updateGroupSettings: (
    convId: string,
    patch: Partial<Pick<Conversation, 'groupAvatar' | 'groupAnnouncement' | 'groupName'>>,
  ) => void;
  /** 追加群成员（去重） */
  addGroupMembers: (convId: string, memberIds: string[]) => void;
  /** 移除单个群成员；群成员 < 2 时抛错 */
  removeGroupMember: (convId: string, memberId: string) => void;
  /** 清除角色的对话记忆（消息+摘要），保留会话并重注入开场白 */
  clearCharacterMemory: (characterId: string) => void;
  /**
   * 确保两个 AI 角色之间的会话存在,不存在则创建。
   * 返回 convId。
   */
  ensureAIChatConversation: (charIdA: string, charIdB: string) => string;

  /** 收藏单条消息（同 messageId 幂等去重） */
  addFavorite: (msg: Message, senderName: string) => void;
  /** 批量收藏（已收藏的自动跳过） */
  addFavorites: (msgs: Message[], getSenderName: (senderId: string) => string) => void;
  /** 按 favorite.id 删除一条收藏 */
  removeFavorite: (id: string) => void;
  /** 按 message id 批量删除消息 */
  deleteMessages: (msgIds: string[]) => void;
  /** 单条转发到目标会话 */
  forwardMessage: (msg: Message, targetConvId: string) => void;
  /** 逐条转发到目标会话 */
  forwardMessages: (msgs: Message[], targetConvId: string) => void;
  /** 合并转发为一张聊天记录卡片 */
  forwardAsCard: (
    msgs: Message[],
    targetConvId: string,
    title: string,
    getSenderName: (senderId: string) => string,
  ) => void;
}

// createUserMsg removed — each send* method now constructs the specific
// discriminated union variant inline for type safety.

/**
 * Entry point from every send* action. The user turn has already been
 * written to memoryStore by the caller via `_appendMessage`; the session
 * path below reuses it verbatim through `session.replyToLast`, so no
 * `userText` needs to be threaded in here.
 */
function scheduleIdolReply(
  convId: string,
  get: () => XingYuDataState,
) {
  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv) return;

  // Character-backed conversation → real AI streaming
  if (conv.characterId) {
    scheduleAICharacterReply(convId, get);
    return;
  }

  // Legacy mock-idol conversation → random reply pool
  if (replyTimers.has(convId)) clearTimeout(replyTimers.get(convId)!);
  const idol = getIdol(conv.idolId);
  if (!idol?.online) return;

  const delay = 1500 + Math.random() * 2000;
  const timer = setTimeout(() => {
    const replies = IDOL_REPLY_POOL[conv.idolId];
    if (!replies?.length) return;
    const reply = replies[Math.floor(Math.random() * replies.length)]!;

    const msg: Message = {
      id: uid(),
      convId,
      senderId: conv.idolId,
      type: 'text',
      text: reply,
      timestamp: Date.now(),
    };
    const state = get();
    const active = isChatActive(convId);
    // Use setState directly to avoid stale closure
    useXYData.setState({
      messages: [...state.messages, msg],
      conversations: state.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMsg: reply,
              lastTime: Date.now(),
              unread: active ? c.unread : c.unread + 1,
            }
          : c,
      ),
    });
    replyTimers.delete(convId);
  }, delay);
  replyTimers.set(convId, timer);
}


/**
 * Sticker-lookup helper used by the unified {type:'sticker', param} path
 * in the bubble dispatch below. Looks up the sticker by stickerId and
 * builds the appropriate Message variant (real sticker when found, text
 * fallback when the ID is unknown).
 */
function buildStickerBubble(args: {
  convId: string;
  senderId: string;
  stickerId: string;
  content: string;
  ts: number;
}): { msg: Message; preview: string } {
  const { convId, senderId, stickerId, content, ts } = args;
  const stickerPacks = useStickerStore.getState().packs;
  let foundSticker: { imageData: string; description: string } | undefined;
  for (const pack of stickerPacks) {
    const s = pack.stickers.find((st) => st.id === stickerId);
    if (s) {
      foundSticker = s;
      break;
    }
  }
  if (foundSticker) {
    return {
      msg: {
        id: uid(),
        convId,
        senderId,
        type: 'sticker',
        stickerUrl: foundSticker.imageData,
        stickerDesc: foundSticker.description,
        timestamp: ts,
      },
      preview: `[表情：${foundSticker.description}]`,
    };
  }
  return {
    msg: {
      id: uid(),
      convId,
      senderId,
      type: 'text',
      text: content || '[表情]',
      timestamp: ts,
    },
    preview: content || '[表情]',
  };
}

/**
 * 非流式 AI 回复 + 多消息投递。
 *
 * M4.2 S7: prompt assembly + chatComplete 下沉进 `chatWithCharacter`
 * session，XingYu 只负责 UI 气泡投递 + 手写 assistant rendered
 * 记忆（memoryStore 用 rendered 形式写入，保留 stale-bubble dedupe
 * 所需的 abort 权威性）。
 *
 * 流程:
 * 1. 显示 typing indicator（streaming placeholder）
 * 2. `session.replyToLast({ mirror: false })` 获取 ChatReply —— 用户轮
 *    已经由 `_appendMessage` 写进 memoryStore，session 直接复用。
 * 3. 移除 placeholder，手动向 memoryStore append 一条 rendered assistant
 * 4. 逐条投递消息（每条间隔 300-800ms），基于 M4.2.5 unified {type, param}
 *    switch 派发: text / sticker / update_signature / 其他(降级文字)
 */
function scheduleAICharacterReply(
  convId: string,
  get: () => XingYuDataState,
) {
  // Abort any in-flight request for this conversation
  const prev = aiSessions.get(convId);
  if (prev) {
    prev.controller.abort();
    prev.session.abort();
  }

  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv?.characterId) return;

  const character = useCharacterStore
    .getState()
    .characters.find((c) => c.id === conv.characterId);
  if (!character) return;

  const aiConfig = useAIConfigStore.getState();
  const senderId = `char-${conv.characterId}`;
  const now = Date.now();

  // Missing API key → immediately inject an error bubble, no network call.
  if (!aiConfig.apiKey) {
    const errText = '[未配置 AI 服务] 请到 设置 → AI 服务 填写 API Key';
    const errMsg: Message = {
      id: uid(),
      convId,
      senderId,
      type: 'text',
      text: errText,
      timestamp: now,
    };
    const state = get();
    useXYData.setState({
      messages: [...state.messages, errMsg],
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, lastMsg: errText, lastTime: now } : c,
      ),
    });
    return;
  }

  const characterId = conv.characterId;

  // ── Show typing indicator ──
  const placeholderId = uid();
  const placeholder: Message = {
    id: placeholderId,
    convId,
    senderId,
    type: 'text',
    text: '',
    timestamp: now,
    streaming: true,
  };
  {
    const s = get();
    useXYData.setState({
      messages: [...s.messages, placeholder],
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, lastTime: now } : c,
      ),
    });
  }

  const controller = new AbortController();

  const showFailureBubble = (errText: string) => {
    const s = useXYData.getState();
    useXYData.setState({
      messages: [
        ...s.messages.filter((m) => m.id !== placeholderId),
        { id: uid(), convId, senderId, type: 'text' as const, text: errText, timestamp: Date.now() },
      ],
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, lastMsg: errText, lastTime: Date.now() } : c,
      ),
    });
  };

  // Wrap session creation in withUserAppContext so the session captures
  // XingYu's appId — which in turn drives Tool Registry / Renderer /
  // AppSystemPrompt lookups frozen into the session for KV-cache
  // stability.
  const sessionInstance = withUserAppContext(XINGYU_APP_ID, () =>
    chatWithCharacter(characterId, {
      persistent: true,
      signal: controller.signal,
      // XingYu takes over the parse-exhaustion UX — show an inline chat
      // bubble instead of the platform's default toast. Any callback
      // (even `() => {}`) suppresses the toast; ours also shows the bubble.
      onParseFailure: () => {
        showFailureBubble('[AI 回复失败] 回复格式错误,已重试 3 次');
      },
    }),
  );
  aiSessions.set(convId, { session: sessionInstance, controller });

  sessionInstance
    // replyToLast instead of send: the user turn is already in memoryStore
    // via `_appendMessage` (see sendMessage et al.), so we don't need the
    // session to push another user entry into its buffer — doing so would
    // make the LLM see the user turn twice (buffer entry + memoryStore
    // entry differ in `createdAt`, so overlay-dedup can't collapse them).
    // mirror:false — we append the assistant entry ourselves below
    // (rendered form, spec D1) so stale-bubble abort logic stays
    // authoritative over the memory write.
    .replyToLast({ mirror: false })
    .then(async (reply: ChatReply) => {
      // Remove typing indicator placeholder
      const s0 = useXYData.getState();
      useXYData.setState({
        messages: s0.messages.filter((m) => m.id !== placeholderId),
      });

      // Empty items can mean either (a) parse exhaustion — in which case
      // onParseFailure already showed the failure bubble, OR (b) a
      // legitimate LLM reply of `[]` (nothing to say). In either case
      // there's nothing to render and no assistant entry to commit.
      if (reply.items.length === 0) {
        return;
      }

      // Assistant memory entry — rendered (natural-language) form. The
      // renderer preserves every decision-relevant identifier (stickerId,
      // action params) so the next prompt still has full context.
      useCharacterMemory.getState().append(characterId, {
        role: 'assistant',
        speakerId: characterId,
        content: reply.rendered,
        source: 'xingyu',
      });

      const active = isChatActive(convId);

      // Deliver messages one by one with natural delays
      for (let i = 0; i < reply.items.length; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
        }
        if (controller.signal.aborted) return;

        const item = reply.items[i]!;
        const ts = Date.now();
        let msg: Message | null = null;
        let lastMsgPreview = '';

        // M4.2.5 unified {type, param} — exhaustive switch over item.type.
        switch (item.type) {
          case 'text': {
            const paramText =
              typeof item.param === 'string' ? item.param : '';
            const text = filterReply(paramText) || '[空回复]';
            msg = {
              id: uid(),
              convId,
              senderId,
              type: 'text',
              text,
              timestamp: ts,
            };
            lastMsgPreview = text.slice(0, 60);
            break;
          }
          case 'sticker': {
            const p = (item.param ?? {}) as {
              stickerId?: unknown;
              content?: unknown;
            };
            const stickerId = typeof p.stickerId === 'string' ? p.stickerId : '';
            const content = typeof p.content === 'string' ? p.content : '';
            const built = buildStickerBubble({
              convId,
              senderId,
              stickerId,
              content,
              ts,
            });
            msg = built.msg;
            lastMsgPreview = built.preview;
            break;
          }
          case 'update_signature': {
            const p = (item.param ?? {}) as { text?: unknown };
            const text = typeof p.text === 'string' ? p.text : '';
            if (text) {
              useXYData
                .getState()
                .updateCharacterSignature(characterId, text);
            }
            continue; // silent — no bubble
          }
          default: {
            // Unknown tool type — fallback to a text bubble with the raw info
            const label = `[${item.type}] ${JSON.stringify(item.param)}`;
            msg = {
              id: uid(),
              convId,
              senderId,
              type: 'text',
              text: label,
              timestamp: ts,
            };
            lastMsgPreview = label.slice(0, 60);
          }
        }

        if (!msg) continue;
        const s = useXYData.getState();
        useXYData.setState({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMsg: lastMsgPreview,
                  lastTime: ts,
                  unread: active ? c.unread : c.unread + 1,
                }
              : c,
          ),
        });
      }
      // Compression is handled automatically by the memoryStore post-append
      // hook (see installAutoCompression). No call needed here.
    })
    .catch((e: unknown) => {
      const errObj = e as { name?: string } | null;
      if (errObj?.name === 'AbortError' || errObj?.name === 'AIAbortedError') return;
      // Keep error message short — raw JSON error bodies in history cause
      // nested-escape issues when re-sent to the API in future requests.
      const rawMsg = e instanceof Error ? e.message : String(e);
      const brief = rawMsg.length > 80 ? `${rawMsg.slice(0, 80)}…` : rawMsg;
      const errText = `[AI 回复失败] ${brief}`;
      const s = useXYData.getState();
      useXYData.setState({
        messages: [
          ...s.messages.filter((m) => m.id !== placeholderId),
          { id: uid(), convId, senderId, type: 'text' as const, text: errText, timestamp: Date.now() },
        ],
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, lastMsg: errText, lastTime: Date.now() } : c,
        ),
      });
    })
    .finally(() => {
      const entry = aiSessions.get(convId);
      if (entry && entry.session === sessionInstance) {
        aiSessions.delete(convId);
      }
    });
}

function extractFavoriteContent(msg: Message): Favorite['content'] {
  switch (msg.type) {
    case 'text':
      return { text: msg.text, noteRef: msg.noteRef, songRef: msg.songRef };
    case 'image':
      return { imageUrl: msg.imageUrl };
    case 'sticker':
      return { stickerUrl: msg.stickerUrl };
    case 'forward_card':
      return { forwardCard: msg.forwardCard };
    case 'heartbeat_log':
      return { text: msg.text };
  }
}

function buildForwardedMessage(
  msg: Message,
  targetConvId: string,
  ts: number,
): { newMsg: Message; preview: string } | null {
  const base = { id: uid(), convId: targetConvId, senderId: 'me', timestamp: ts };
  switch (msg.type) {
    case 'text': {
      const newMsg: Message = {
        ...base,
        type: 'text',
        text: msg.text,
        ...(msg.noteRef ? { noteRef: msg.noteRef } : {}),
        ...(msg.songRef ? { songRef: msg.songRef } : {}),
      };
      const preview = msg.noteRef
        ? `[备忘录] ${msg.noteRef.title}`
        : msg.songRef
          ? `[音乐] ${msg.songRef.title}`
          : msg.text.slice(0, 60);
      return { newMsg, preview };
    }
    case 'image':
      return {
        newMsg: { ...base, type: 'image', imageUrl: msg.imageUrl },
        preview: '[图片]',
      };
    case 'sticker':
      return {
        newMsg: {
          ...base,
          type: 'sticker',
          stickerUrl: msg.stickerUrl,
          ...(msg.stickerDesc ? { stickerDesc: msg.stickerDesc } : {}),
        },
        preview: '[表情]',
      };
    case 'forward_card':
      return {
        newMsg: { ...base, type: 'forward_card', forwardCard: msg.forwardCard },
        preview: '[聊天记录]',
      };
    case 'heartbeat_log':
      return null;
  }
}

export const useXYData = create<XingYuDataState>()(
  persist(
    (set, get) => ({
      conversations: SEED_CONVS,
      messages: SEED_MSGS,
      moments: SEED_MOMENTS,
      characterSignatures: {},
      userSignatureHistory: [],
      interactions: [],
      unreadInteractionCount: 0,
      characterLastReadMsgTs: {},
      characterSeenInteractionCount: {},
      favorites: [],

      userSettings: {
        nickname: '小星星',
        bio: '',
        accentColor: '#007AFF',
        avatarUrl: '/resource/avatars/cute.png',
        coverUrl: '',
      },

      sendMessage: (convId, text, quoteRef) => {
        const msg: TextMessage = {
          id: uid(),
          convId,
          senderId: 'me',
          type: 'text',
          text,
          timestamp: Date.now(),
          ...(quoteRef ? { quoteRef } : {}),
        };
        fireAppSwitchMarker(convId, get);
        _appendMessage(msg, 'xingyu');
        scheduleIdolReply(convId, get);
      },

      sendNoteMessage: (convId, noteRef) => {
        const previewTitle = noteRef.title || '无标题';
        const text = `[备忘录分享] ${previewTitle}\n${noteRef.body}`;
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'text', text, noteRef, timestamp: Date.now() };
        fireAppSwitchMarker(convId, get);
        _appendMessage(msg, 'xingyu');
        scheduleIdolReply(convId, get);
      },

      sendSongMessage: (convId, songRef, lyricsText) => {
        const parts = [`[音乐分享] ${songRef.title} - ${songRef.artist}`];
        if (lyricsText) parts.push(`\n歌词:\n${lyricsText}`);
        const text = parts.join('');
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'text', text, songRef, timestamp: Date.now() };
        fireAppSwitchMarker(convId, get);
        _appendMessage(msg, 'xingyu');
        scheduleIdolReply(convId, get);
      },

      sendImageMessage: (convId, imageUrl) => {
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'image', imageUrl, timestamp: Date.now() };
        fireAppSwitchMarker(convId, get);
        _appendMessage(msg, 'xingyu');
        scheduleIdolReply(convId, get);
      },

      sendStickerMessage: (convId, stickerUrl, stickerDesc) => {
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'sticker', stickerUrl, stickerDesc, timestamp: Date.now() };
        fireAppSwitchMarker(convId, get);
        _appendMessage(msg, 'xingyu');
        scheduleIdolReply(convId, get);
      },

      markRead: (convId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, unread: 0 } : c,
          ),
        })),

      deleteConversation: (convId) => {
        // Tear down side-effects first — otherwise an in-flight AI stream
        // would keep pushing tokens into a conv we just dropped.
        const timer = replyTimers.get(convId);
        if (timer) {
          clearTimeout(timer);
          replyTimers.delete(convId);
        }
        const entry = aiSessions.get(convId);
        if (entry) {
          entry.controller.abort();
          entry.session.abort();
          aiSessions.delete(convId);
        }
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== convId),
          messages: s.messages.filter((m) => m.convId !== convId),
        }));
      },

      toggleLike: (momentId, userId = 'me') =>
        set((s) => {
          const mo = s.moments.find((m) => m.id === momentId);
          if (!mo) return s;
          const alreadyLiked = mo.likedBy.includes(userId);
          const newMoments = s.moments.map((m) =>
            m.id === momentId
              ? {
                  ...m,
                  likedBy: alreadyLiked
                    ? m.likedBy.filter((id) => id !== userId)
                    : [...m.likedBy, userId],
                }
              : m,
          );
          // Generate interaction only when someone else likes the player's moment
          let newInteractions = s.interactions;
          let newUnread = s.unreadInteractionCount;
          if (!alreadyLiked && mo.idolId === 'me' && userId !== 'me') {
            const interaction: MomentInteraction = {
              id: uid(),
              type: 'like',
              momentId,
              momentTextSnippet: mo.text.slice(0, 30),
              userId,
              timestamp: Date.now(),
            };
            newInteractions = [interaction, ...s.interactions].slice(0, 200);
            newUnread += 1;
          }
          return { moments: newMoments, interactions: newInteractions, unreadInteractionCount: newUnread };
        }),

      addMoment: (text, imageUrl) => {
        const moment: Moment = {
          id: uid(),
          idolId: 'me',
          text,
          imageUrl,
          likedBy: [],
          timestamp: Date.now(),
          comments: [],
        };
        set((s) => ({ moments: [moment, ...s.moments] }));
      },

      addComment: (momentId, text, userId = 'me') =>
        set((s) => {
          const mo = s.moments.find((m) => m.id === momentId);
          if (!mo) return s;
          const newMoments = s.moments.map((m) =>
            m.id === momentId
              ? { ...m, comments: [...m.comments, { userId, text }] }
              : m,
          );
          // Generate interaction only when someone else comments on the player's moment
          let newInteractions = s.interactions;
          let newUnread = s.unreadInteractionCount;
          if (mo.idolId === 'me' && userId !== 'me') {
            const interaction: MomentInteraction = {
              id: uid(),
              type: 'comment',
              momentId,
              momentTextSnippet: mo.text.slice(0, 30),
              userId,
              commentText: text,
              timestamp: Date.now(),
            };
            newInteractions = [interaction, ...s.interactions].slice(0, 200);
            newUnread += 1;
          }
          return { moments: newMoments, interactions: newInteractions, unreadInteractionCount: newUnread };
        }),

      markInteractionsRead: () => set({ unreadInteractionCount: 0 }),
      markCharacterMsgRead: (characterId) =>
        set((s) => ({
          characterLastReadMsgTs: { ...s.characterLastReadMsgTs, [characterId]: Date.now() },
        })),
      markCharacterInteractionRead: (characterId, count) =>
        set((s) => ({
          characterSeenInteractionCount: { ...s.characterSeenInteractionCount, [characterId]: count },
        })),

      updateSettings: (settings) =>
        set((s) => {
          // Track bio changes in signature history
          const bioChanged =
            settings.bio !== undefined && settings.bio !== s.userSettings.bio && s.userSettings.bio;
          return {
            userSettings: { ...s.userSettings, ...settings },
            userSignatureHistory: bioChanged
              ? [
                  { text: s.userSettings.bio, timestamp: Date.now() },
                  ...s.userSignatureHistory,
                ]
              : s.userSignatureHistory,
          };
        }),

      updateCharacterSignature: (characterId, text) =>
        set((s) => {
          const existing = s.characterSignatures[characterId];
          const oldText = existing?.current ?? '';
          const history = existing?.history ?? [];
          return {
            characterSignatures: {
              ...s.characterSignatures,
              [characterId]: {
                current: text,
                history: oldText
                  ? [{ text: oldText, timestamp: Date.now() }, ...history]
                  : history,
              },
            },
          };
        }),

      ensureIdolConversation: (idolId) => {
        const convId = `c-${idolId}`;
        const state = get();
        const existing = state.conversations.find((c) => c.id === convId);
        if (existing) return convId;

        const idol = getIdol(idolId);
        if (!idol) return convId;

        const conv: Conversation = {
          id: convId,
          idolId,
          lastMsg: idol.bio || idol.title,
          lastTime: Date.now(),
          unread: 0,
        };
        set({ conversations: [conv, ...state.conversations] });
        return convId;
      },

      updateConversationSettings: (convId, patch) => {
        set({
          conversations: get().conversations.map((c) =>
            c.id === convId ? { ...c, ...patch } : c,
          ),
        });
      },

      createGroupConversation: (memberIds) => {
        const stripped = memberIds.map(stripCharPrefix);
        const name = deriveGroupName(stripped);
        const convId = `c-group-${uid()}`;
        const conv: Conversation = {
          id: convId,
          idolId: convId,
          lastMsg: '',
          lastTime: Date.now(),
          unread: 0,
          groupName: name,
          groupMemberIds: stripped,
        };
        set({ conversations: [conv, ...get().conversations] });
        return convId;
      },

      updateGroupSettings: (convId, patch) => {
        set({
          conversations: get().conversations.map((c) =>
            c.id === convId && c.groupMemberIds ? { ...c, ...patch } : c,
          ),
        });
      },

      addGroupMembers: (convId, newIds) => {
        const stripped = newIds.map(stripCharPrefix);
        set({
          conversations: get().conversations.map((c) => {
            if (c.id !== convId || !c.groupMemberIds) return c;
            const merged = Array.from(new Set([...c.groupMemberIds, ...stripped]));
            return { ...c, groupMemberIds: merged };
          }),
        });
      },

      removeGroupMember: (convId, memberId) => {
        const conv = get().conversations.find((c) => c.id === convId);
        if (!conv?.groupMemberIds) return;
        if (conv.groupMemberIds.length <= 2) {
          throw new Error('至少需保留 2 名成员');
        }
        set({
          conversations: get().conversations.map((c) =>
            c.id === convId && c.groupMemberIds
              ? { ...c, groupMemberIds: c.groupMemberIds.filter((id) => id !== memberId) }
              : c,
          ),
        });
      },

      ensureCharacterConversation: (characterId) => {
        const convId = `c-char-${characterId}`;
        const state = get();
        const existing = state.conversations.find((c) => c.id === convId);
        if (existing) return convId;

        const character = useCharacterStore
          .getState()
          .characters.find((c) => c.id === characterId);
        if (!character) return convId;

        const senderId = `char-${characterId}`;
        const now = Date.now();
        const firstMsgText = character.firstMessage?.trim() || '';
        const seedMessages: Message[] = firstMsgText
          ? [
              {
                id: uid(),
                convId,
                senderId,
                type: 'text',
                text: firstMsgText,
                timestamp: now,
              },
            ]
          : [];

        const conv: Conversation = {
          id: convId,
          idolId: senderId, // placeholder so getIdol() won't crash; ChatDetail should branch on characterId
          characterId,
          lastMsg: firstMsgText || character.name,
          lastTime: now,
          unread: firstMsgText ? 1 : 0,
        };

        set({
          conversations: [conv, ...state.conversations],
          messages: [...state.messages, ...seedMessages],
        });
        return convId;
      },

      clearCharacterMemory: (characterId) => {
        const convId = `c-char-${characterId}`;

        // Abort in-flight AI stream
        const entry = aiSessions.get(convId);
        if (entry) {
          entry.controller.abort();
          entry.session.abort();
          aiSessions.delete(convId);
        }
        const timer = replyTimers.get(convId);
        if (timer) {
          clearTimeout(timer);
          replyTimers.delete(convId);
        }

        const character = useCharacterStore
          .getState()
          .characters.find((c) => c.id === characterId);
        const senderId = `char-${characterId}`;
        const now = Date.now();
        const firstMsgText = character?.firstMessage?.trim() || '';

        // Re-inject firstMessage as fresh start
        const seedMessages: Message[] = firstMsgText
          ? [{
              id: uid(),
              convId,
              senderId,
              type: 'text',
              text: firstMsgText,
              timestamp: now,
            }]
          : [];

        set((s) => ({
          // Remove all messages for this conversation, then add seed
          messages: [
            ...s.messages.filter((m) => m.convId !== convId),
            ...seedMessages,
          ],
          // Reset summary and update lastMsg
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMsg: firstMsgText || character?.name || '',
                  lastTime: now,
                  unread: 0,
                }
              : c,
          ),
        }));
      },

      addFavorite: (msg, senderName) => {
        set((s) => {
          if (s.favorites.some((f) => f.messageId === msg.id)) return s;
          const fav: Favorite = {
            id: uid(),
            messageId: msg.id,
            convId: msg.convId,
            senderId: msg.senderId,
            senderName,
            type: msg.type,
            content: extractFavoriteContent(msg),
            timestamp: msg.timestamp,
            favoritedAt: Date.now(),
          };
          return { favorites: [...s.favorites, fav] };
        });
      },

      addFavorites: (msgs, getSenderName) => {
        set((s) => {
          const existingIds = new Set(s.favorites.map((f) => f.messageId));
          const now = Date.now();
          const newFavs: Favorite[] = msgs
            .filter((m) => !existingIds.has(m.id))
            .map((msg) => ({
              id: uid(),
              messageId: msg.id,
              convId: msg.convId,
              senderId: msg.senderId,
              senderName: getSenderName(msg.senderId),
              type: msg.type,
              content: extractFavoriteContent(msg),
              timestamp: msg.timestamp,
              favoritedAt: now,
            }));
          if (newFavs.length === 0) return s;
          return { favorites: [...s.favorites, ...newFavs] };
        });
      },

      removeFavorite: (id) => {
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
      },

      deleteMessages: (msgIds) => {
        const idSet = new Set(msgIds);
        set((s) => ({
          messages: s.messages.filter((m) => !idSet.has(m.id)),
        }));
      },

      forwardMessage: (msg, targetConvId) => {
        const now = Date.now();
        const built = buildForwardedMessage(msg, targetConvId, now);
        if (!built) return;
        const { newMsg } = built;
        _appendMessage(newMsg, 'xingyu');
        scheduleIdolReply(targetConvId, get);
      },

      forwardMessages: (msgs, targetConvId) => {
        if (msgs.length === 0) return;
        const now = Date.now();
        const built = msgs
          .map((m, i) => buildForwardedMessage(m, targetConvId, now + i))
          .filter((b): b is { newMsg: Message; preview: string } => b !== null);
        if (built.length === 0) return;
        for (const b of built) {
          _appendMessage(b.newMsg, 'xingyu');
        }
        // Override the lastMsg with the batch preview (matches existing behaviour)
        const lastPreview = `[转发] ${built.length}条消息`;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === targetConvId
              ? { ...c, lastMsg: lastPreview, lastTime: now + built.length }
              : c,
          ),
        }));
        scheduleIdolReply(targetConvId, get);
      },

      forwardAsCard: (msgs, targetConvId, title, getSenderName) => {
        const now = Date.now();
        const forwarded: ForwardedMsg[] = msgs.map((m) => {
          const flatType: 'text' | 'image' | 'sticker' =
            m.type === 'image' ? 'image' : m.type === 'sticker' ? 'sticker' : 'text';
          return {
            senderId: m.senderId,
            senderName: getSenderName(m.senderId),
            type: flatType,
            text:
              m.type === 'text'
                ? m.text
                : m.type === 'heartbeat_log'
                  ? m.text
                  : m.type === 'forward_card'
                    ? '[聊天记录]'
                    : undefined,
            imageUrl: m.type === 'image' ? m.imageUrl : undefined,
            stickerUrl: m.type === 'sticker' ? m.stickerUrl : undefined,
            timestamp: m.timestamp,
          };
        });
        const preview = forwarded.slice(0, 4).map((f) => {
          const content = f.text || (f.imageUrl ? '[图片]' : '[表情]');
          return `${f.senderName}: ${content.slice(0, 20)}`;
        });
        const cardMsg: ForwardCardMessage = {
          id: uid(),
          convId: targetConvId,
          senderId: 'me',
          type: 'forward_card',
          forwardCard: { title, messages: forwarded, preview },
          timestamp: now,
        };
        _appendMessage(cardMsg, 'xingyu');
        // Override the default "[聊天记录：<title>]" preview with the simpler
        // "[聊天记录]" to match the existing UI expectation.
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === targetConvId ? { ...c, lastMsg: '[聊天记录]' } : c,
          ),
        }));
        scheduleIdolReply(targetConvId, get);
      },

      ensureAIChatConversation: (charIdA, charIdB) => {
        const [id1, id2] = [charIdA, charIdB].sort() as [string, string];
        const convId = `c-ai2ai-${id1}-${id2}`;
        const existing = get().conversations.find((c) => c.id === convId);
        if (existing) return convId;

        const conv: Conversation = {
          id: convId,
          idolId: `char-${id1}`,
          aiChatParticipants: [id1, id2],
          lastMsg: '',
          lastTime: Date.now(),
          unread: 0,
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
        }));
        return convId;
      },
    }),
    {
      name: 'hiPhone-xingyu',
      // messages & moments are persisted per-record via idbRecordStorage,
      // NOT in this KV blob. Only config-like fields go here.
      partialize: (s) => ({
        conversations: s.conversations,
        userSettings: s.userSettings,
        characterSignatures: s.characterSignatures,
        userSignatureHistory: s.userSignatureHistory,
        interactions: s.interactions,
        unreadInteractionCount: s.unreadInteractionCount,
        characterLastReadMsgTs: s.characterLastReadMsgTs,
        characterSeenInteractionCount: s.characterSeenInteractionCount,
        favorites: s.favorites,
      }),
      storage: idbStorage,
      onRehydrateStorage: () => {
        return async (_state, error) => {
          if (error) {
            console.warn('[xingyu] rehydration error:', error);
            return;
          }
          // Load per-record data from IndexedDB object stores
          const [messages, rawMoments] = await Promise.all([
            loadAllMessages(),
            loadAllMoments(),
          ]);
          // Migrate old moments: {liked, likes} → {likedBy}
          const moments = (rawMoments as (Moment & { liked?: boolean; likes?: number })[]).map(
            (m) => {
              if ('likedBy' in m && Array.isArray(m.likedBy)) return m as Moment;
              return {
                ...m,
                likedBy: (m as { liked?: boolean }).liked ? ['me'] : [],
              } as Moment;
            },
          );
          useXYData.setState({ messages, moments });
          // Start write-through sync (subscribe to future changes)
          startXYDataSync(useXYData);

          // AI character memory: rehydrate from IDB + start mirroring.
          // Empty on first boot after M4.1 upgrade — intentional (no data migration).
          await loadCharacterMemoryFromIdb();
          startCharacterMemoryIdbSync();
          installAutoCompression();
        };
      },
    },
  ),
);
