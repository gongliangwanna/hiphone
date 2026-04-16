import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { loadAllMessages, loadAllMoments } from '@/platform/storage/idbRecordStorage';
import { startXYDataSync } from '@/platform/storage/zustandIdbSync';
import { uid } from '@/platform/utils/uid';
import type { Conversation, Message, Moment, MomentInteraction } from './data';
import {
  SEED_CONVS,
  SEED_MSGS,
  SEED_MOMENTS,
  IDOL_REPLY_POOL,
  getIdol,
} from './data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { getAdapter } from '@/platform/ai/providers';
import { assemblePrompt, type HistoryMessage } from '@/platform/ai/promptAssembly';
import { chatComplete } from '@/platform/ai/chatComplete';
import { parseReply } from '@/platform/ai/replyParser';
import { compressHistory } from '@/platform/ai/summarizer';
import { buildDeviceContext } from '@/platform/ai/deviceContext';
import { filterReply } from '@/platform/ai/replyFilters';
import { useXYNav } from './xingYuNavStore';
import { useStickerStore } from './stickerStore';

/**
 * 某 conv 当前是否正被用户"看着":
 * 如果是,回复到达时就不要 unread++,否则"边看边红点"很蠢。
 * navStore 只依赖 zustand,不会反向 import dataStore,无循环依赖风险。
 */
function isChatActive(convId: string): boolean {
  return useXYNav.getState().activeChatId === convId;
}

/**
 * Collect all messages relevant to a character's prompt context:
 * - Messages from the primary user-character conversation (c-char-{characterId})
 * - Messages from all AI-AI conversations where this character participates
 *
 * Returns HistoryMessage[] sorted by timestamp, ready for assemblePrompt.
 */
export function collectCharacterHistory(
  characterId: string,
  state: { messages: Message[]; conversations: Conversation[] },
): HistoryMessage[] {
  const primaryConvId = `c-char-${characterId}`;

  const aiAiConvIds = state.conversations
    .filter((c) => c.aiChatParticipants?.includes(characterId))
    .map((c) => c.id);

  const relevantConvIds = new Set([primaryConvId, ...aiAiConvIds]);

  return state.messages
    .filter((m) => relevantConvIds.has(m.convId))
    .map((m) => ({
      senderId: m.senderId,
      type: m.type,
      text: m.type === 'text' || m.type === 'heartbeat_log' ? m.text : undefined,
      imageUrl: m.type === 'image' ? m.imageUrl : undefined,
      stickerDesc: m.type === 'sticker' ? m.stickerDesc : undefined,
      timestamp: m.timestamp,
    }));
}

/* ── Auto-reply timers (module-level, not serializable) ── */
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();
/* ── In-flight AI stream controllers, keyed by convId ── */
const aiControllers = new Map<string, AbortController>();

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

  sendMessage: (convId: string, text: string) => void;
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
  /** 创建用户自建群聊，返回 convId */
  createGroupConversation: (name: string, memberIds: string[]) => string;
  /** 清除角色的对话记忆（消息+摘要），保留会话并重注入开场白 */
  clearCharacterMemory: (characterId: string) => void;
  /**
   * 确保两个 AI 角色之间的会话存在,不存在则创建。
   * 返回 convId。
   */
  ensureAIChatConversation: (charIdA: string, charIdB: string) => string;
}

// createUserMsg removed — each send* method now constructs the specific
// discriminated union variant inline for type safety.

function scheduleIdolReply(convId: string, get: () => XingYuDataState) {
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
 * 后台触发 context 压缩。
 * 将当前会话中旧消息（summary 已覆盖的时间戳之前的不重复压缩）交给 LLM 生成摘要，
 * 结果写入 conversation.summary + summaryUpToTimestamp。
 */
export function triggerCompression(
  convId: string,
  endpoint: string,
  aiConfig: { apiKey: string; model: string; provider: string },
) {
  const s = useXYData.getState();
  const conv = s.conversations.find((c) => c.id === convId);
  if (!conv) return;

  // Gather messages for this conversation, sorted chronologically
  const convMsgs = s.messages
    .filter((m) => m.convId === convId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Only compress messages we haven't already summarized
  const cutoff = conv.summaryUpToTimestamp ?? 0;
  // Keep the most recent N messages out of compression (they stay as full history)
  const keepRecent = useAIConfigStore.getState().keepRecentMessages;
  const recentBoundary = convMsgs.length > keepRecent
    ? convMsgs[convMsgs.length - keepRecent]!.timestamp
    : 0;

  const toCompress = convMsgs.filter(
    (m) => m.timestamp > cutoff && m.timestamp < recentBoundary,
  );
  if (toCompress.length === 0) return;

  const messagesToCompress = toCompress.map((m) => ({
    role: (m.senderId === 'me' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.type === 'text' || m.type === 'heartbeat_log'
      ? m.text
      : m.type === 'image'
        ? '[图片]'
        : m.type === 'sticker'
          ? `[表情：${m.stickerDesc ?? '表情包'}]`
          : '',
  }));

  const lastTimestamp = toCompress[toCompress.length - 1]!.timestamp;

  // Resolve character & user names for first-person summary
  const characterId = convId.replace('c-char-', '');
  const character = useCharacterStore.getState().characters.find((c) => c.id === characterId);
  const persona = usePersonaStore.getState().getActivePersona();
  const fullAiConfig = useAIConfigStore.getState();

  compressHistory({
    previousSummary: conv.summary,
    messagesToCompress,
    endpoint,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    providerId: aiConfig.provider,
    characterName: character?.name ?? '角色',
    userName: persona?.name ?? '用户',
    contextWindow: fullAiConfig.contextWindow,
    maxTokens: fullAiConfig.maxTokens,
  })
    .then((summary) => {
      const current = useXYData.getState();
      useXYData.setState({
        conversations: current.conversations.map((c) =>
          c.id === convId
            ? { ...c, summary, summaryUpToTimestamp: lastTimestamp }
            : c,
        ),
      });
    })
    .catch((e) => {
      console.warn('[summarizer] compression failed:', e);
    });
}

/**
 * 非流式 AI 回复 + 多消息投递。
 *
 * 流程:
 * 1. 显示 typing indicator（streaming placeholder）
 * 2. 调 chatComplete() 获取完整回复
 * 3. parseReply() 解析 JSON 数组
 * 4. 移除 placeholder，逐条投递消息（每条间隔 300-800ms）
 */
function scheduleAICharacterReply(convId: string, get: () => XingYuDataState) {
  // Abort any in-flight request for this conversation
  const prev = aiControllers.get(convId);
  if (prev) prev.abort();

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

  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return;
  const endpoint = aiConfig.apiEndpoint || adapter.defaultEndpoint;

  // ── Assemble prompt via the pipeline ──
  const persona = usePersonaStore.getState().getActivePersona();
  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();

  const historyMsgs = collectCharacterHistory(conv.characterId!, get());

  // Collect available stickers for the AI
  const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
    pack.stickers.map((s) => ({ id: s.id, description: s.description })),
  );

  const characterSenderId = `char-${conv.characterId}`;

  // Build sender name map for other characters that may appear in history
  const senderNames: Record<string, string> = {};
  const allCharacters = useCharacterStore.getState().characters;
  for (const m of historyMsgs) {
    if (m.senderId !== 'me' && m.senderId !== characterSenderId && !senderNames[m.senderId]) {
      const charId = m.senderId.replace(/^char-/, '');
      const found = allCharacters.find((c) => c.id === charId);
      if (found) senderNames[m.senderId] = found.name;
    }
  }

  const { messages: chatMessages, historyTokenRatio } = assemblePrompt({
    character: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
      messageExamples: character.messageExamples,
    },
    persona: {
      name: persona?.name ?? '用户',
      description: persona?.description ?? '',
    },
    aiConfig: {
      systemPrompt: aiConfig.systemPrompt,
      postHistoryInstructions: aiConfig.postHistoryInstructions,
      contextWindow: aiConfig.contextWindow,
      maxTokens: aiConfig.maxTokens,
      keepRecentMessages: aiConfig.keepRecentMessages,
      worldInfoBudgetPercent: aiConfig.worldInfoBudgetPercent,
      enableVision: aiConfig.enableVision,
    },
    worldBookChunk,
    history: historyMsgs,
    now: new Date(),
    summary: conv.summary,
    summaryUpToTimestamp: conv.summaryUpToTimestamp,
    deviceContext: buildDeviceContext(),
    availableStickers: allStickers.length > 0 ? allStickers : undefined,
    characterSenderId,
    senderNames,
  });

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
  aiControllers.set(convId, controller);

  chatComplete(
    { endpoint, apiKey: aiConfig.apiKey, model: aiConfig.model, providerId: aiConfig.provider },
    chatMessages,
    {
      maxTokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      topP: aiConfig.topP,
      frequencyPenalty: aiConfig.frequencyPenalty,
      presencePenalty: aiConfig.presencePenalty,
      reasoningEffort: aiConfig.reasoningEffort !== 'off' ? aiConfig.reasoningEffort : undefined,
    },
    controller.signal,
  )
    .then(async (rawReply) => {
      // Remove typing indicator placeholder
      const s0 = useXYData.getState();
      useXYData.setState({
        messages: s0.messages.filter((m) => m.id !== placeholderId),
      });

      // Parse structured reply
      const items = parseReply(rawReply);
      const active = isChatActive(convId);

      // Deliver messages one by one with natural delays
      for (let i = 0; i < items.length; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
        }
        if (controller.signal.aborted) return;

        const item = items[i]!;
        const ts = Date.now();

        // Signature update — silent, no chat bubble
        if (item.type === 'signature') {
          if (conv.characterId) {
            useXYData.getState().updateCharacterSignature(conv.characterId, item.text);
          }
          continue;
        }

        let msg: Message;
        let lastMsgPreview: string;

        if (item.type === 'sticker') {
          // Look up the sticker by ID from the store
          const stickerPacks = useStickerStore.getState().packs;
          let foundSticker: { imageData: string; description: string } | undefined;
          for (const pack of stickerPacks) {
            const s = pack.stickers.find((st) => st.id === item.stickerId);
            if (s) { foundSticker = s; break; }
          }

          if (foundSticker) {
            msg = {
              id: uid(),
              convId,
              senderId,
              type: 'sticker',
              stickerUrl: foundSticker.imageData,
              stickerDesc: foundSticker.description,
              timestamp: ts,
            };
            lastMsgPreview = `[表情：${foundSticker.description}]`;
          } else {
            // Sticker not found — fallback to text
            msg = {
              id: uid(),
              convId,
              senderId,
              type: 'text',
              text: item.content || '[表情]',
              timestamp: ts,
            };
            lastMsgPreview = item.content || '[表情]';
          }
        } else {
          const text = filterReply(item.content) || '[空回复]';
          msg = {
            id: uid(),
            convId,
            senderId,
            type: 'text',
            text,
            timestamp: ts,
          };
          lastMsgPreview = text.slice(0, 60);
        }

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

      // ── Context compression check ──
      const threshold = useAIConfigStore.getState().summarizeThreshold;
      if (threshold > 0 && historyTokenRatio > threshold) {
        triggerCompression(convId, endpoint, aiConfig);
      }
    })
    .catch((e) => {
      if (e?.name === 'AbortError') return;
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
      if (aiControllers.get(convId) === controller) {
        aiControllers.delete(convId);
      }
    });
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

      userSettings: {
        nickname: '小星星',
        bio: '',
        accentColor: '#007AFF',
        avatarUrl: '/resource/avatars/cute.png',
        coverUrl: '',
      },

      sendMessage: (convId, text) => {
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'text', text, timestamp: Date.now() };
        set((s) => ({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMsg: text, lastTime: Date.now(), unread: 0 }
              : c,
          ),
        }));
        scheduleIdolReply(convId, get);
      },

      sendNoteMessage: (convId, noteRef) => {
        const previewTitle = noteRef.title || '无标题';
        const text = `[备忘录分享] ${previewTitle}\n${noteRef.body}`;
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'text', text, noteRef, timestamp: Date.now() };
        set((s) => ({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMsg: `[备忘录] ${previewTitle}`, lastTime: Date.now(), unread: 0 }
              : c,
          ),
        }));
        scheduleIdolReply(convId, get);
      },

      sendSongMessage: (convId, songRef, lyricsText) => {
        const parts = [`[音乐分享] ${songRef.title} - ${songRef.artist}`];
        if (lyricsText) parts.push(`\n歌词:\n${lyricsText}`);
        const text = parts.join('');
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'text', text, songRef, timestamp: Date.now() };
        set((s) => ({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMsg: `[音乐] ${songRef.title}`, lastTime: Date.now(), unread: 0 }
              : c,
          ),
        }));
        scheduleIdolReply(convId, get);
      },

      sendImageMessage: (convId, imageUrl) => {
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'image', imageUrl, timestamp: Date.now() };
        set((s) => ({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMsg: '[图片]', lastTime: Date.now(), unread: 0 }
              : c,
          ),
        }));
        scheduleIdolReply(convId, get);
      },

      sendStickerMessage: (convId, stickerUrl, stickerDesc) => {
        const msg: Message = { id: uid(), convId, senderId: 'me', type: 'sticker', stickerUrl, stickerDesc, timestamp: Date.now() };
        set((s) => ({
          messages: [...s.messages, msg],
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMsg: '[表情]', lastTime: Date.now(), unread: 0 }
              : c,
          ),
        }));
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
        const controller = aiControllers.get(convId);
        if (controller) {
          controller.abort();
          aiControllers.delete(convId);
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

      createGroupConversation: (name, memberIds) => {
        const convId = `c-group-${uid()}`;
        const conv: Conversation = {
          id: convId,
          idolId: convId, // placeholder
          lastMsg: '',
          lastTime: Date.now(),
          unread: 0,
          groupName: name,
          groupMemberIds: memberIds,
        };
        set({ conversations: [conv, ...get().conversations] });
        return convId;
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
        const controller = aiControllers.get(convId);
        if (controller) {
          controller.abort();
          aiControllers.delete(convId);
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
                  summary: undefined,
                  summaryUpToTimestamp: undefined,
                  lastMsg: firstMsgText || character?.name || '',
                  lastTime: now,
                  unread: 0,
                }
              : c,
          ),
        }));
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
        };
      },
    },
  ),
);
