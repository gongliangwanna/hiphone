import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message, Moment } from './data';
import {
  SEED_CONVS,
  SEED_MSGS,
  SEED_MOMENTS,
  DEFAULT_STICKER_PACK_IDS,
  IDOL_REPLY_POOL,
  getIdol,
} from './data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { streamChat, getAdapter } from '@/platform/ai/providers';

/* ── Auto-reply timers (module-level, not serializable) ── */
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();
/* ── In-flight AI stream controllers, keyed by convId ── */
const aiControllers = new Map<string, AbortController>();

/**
 * UUID 生成的稳健 fallback。
 * uid() 需要 secure context 且 iOS Safari 15.4+,
 * 任何一个条件不满足都会抛错,导致 sendMessage 静默失败。
 */
function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface UserSettings {
  nickname: string;
  bio: string;
  accentColor: string;
  avatarUrl: string;
  coverUrl: string;
}

interface XingYuDataState {
  conversations: Conversation[];
  messages: Message[];
  moments: Moment[];
  installedStickerPackIds: string[];
  userSettings: UserSettings;

  sendMessage: (convId: string, text: string) => void;
  sendImageMessage: (convId: string, imageUrl: string) => void;
  sendStickerMessage: (convId: string, stickerEmoji: string) => void;
  markRead: (convId: string) => void;
  toggleLike: (momentId: string) => void;
  installStickerPack: (packId: string) => void;
  uninstallStickerPack: (packId: string) => void;
  addMoment: (text: string, imageUrl?: string) => void;
  addComment: (momentId: string, text: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  /**
   * 确保指定 character 的会话存在,不存在则创建并插入 firstMessage。
   * 返回 convId,供导航跳转使用。
   */
  ensureCharacterConversation: (characterId: string) => string;
}

function createUserMsg(
  convId: string,
  type: Message['type'],
  extra: Partial<Message>,
): Message {
  return {
    id: uid(),
    convId,
    senderId: 'me',
    type,
    timestamp: Date.now(),
    ...extra,
  };
}

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
    // Use setState directly to avoid stale closure
    useXYData.setState({
      messages: [...state.messages, msg],
      conversations: state.conversations.map((c) =>
        c.id === convId
          ? { ...c, lastMsg: reply, lastTime: Date.now(), unread: c.unread + 1 }
          : c,
      ),
    });
    replyTimers.delete(convId);
  }, delay);
  replyTimers.set(convId, timer);
}

/**
 * 用 streamChat() 驱动 character 会话的真实 AI 回复。
 * 流程: 先 insert 一条 streaming placeholder → onToken append → 结束/出错时 finalize。
 */
function scheduleAICharacterReply(convId: string, get: () => XingYuDataState) {
  // Abort any in-flight stream for this conversation
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

  // ── Build system prompt (character + aiConfig global) ──
  const baseline = [
    `You are ${character.name}.`,
    character.description && character.description.trim(),
    character.personality && `Personality: ${character.personality}`,
    character.scenario && `Scenario: ${character.scenario}`,
    'Reply in character, in the user\'s language. Keep replies short and natural for a chat app.',
  ]
    .filter(Boolean)
    .join('\n');

  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();

  const systemChunks = [
    character.systemPrompt?.trim(),
    aiConfig.systemPrompt?.trim(),
    worldBookChunk,
    baseline,
  ].filter((s): s is string => !!s && s.length > 0);
  const systemPrompt = systemChunks.join('\n\n');

  // ── Build history (text-only, keepRecentMessages sliding window) ──
  const allMsgs = get()
    .messages.filter((m) => m.convId === convId && m.type === 'text' && m.text)
    .sort((a, b) => a.timestamp - b.timestamp);
  const keep = Math.max(1, aiConfig.keepRecentMessages ?? 50);
  const recent = allMsgs.slice(-keep);

  const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...recent.map((m) => ({
      role: (m.senderId === 'me' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text!,
    })),
  ];

  // ── Insert streaming placeholder ──
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

  let accumulated = '';
  streamChat(
    {
      endpoint,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      providerId: aiConfig.provider,
    },
    chatMessages,
    (token) => {
      accumulated += token;
      const s = useXYData.getState();
      useXYData.setState({
        messages: s.messages.map((m) =>
          m.id === placeholderId ? { ...m, text: accumulated } : m,
        ),
      });
    },
    controller.signal,
  )
    .then(() => {
      const finalText = accumulated || '[空回复]';
      const finishedAt = Date.now();
      const s = useXYData.getState();
      useXYData.setState({
        messages: s.messages.map((m) =>
          m.id === placeholderId
            ? { ...m, text: finalText, streaming: false, timestamp: finishedAt }
            : m,
        ),
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? { ...c, lastMsg: finalText.slice(0, 60), lastTime: finishedAt, unread: c.unread + 1 }
            : c,
        ),
      });
    })
    .catch((e) => {
      // Ignore aborts triggered by a newer request on the same convo.
      if (e?.name === 'AbortError') return;
      const errText = `[AI 回复失败] ${e instanceof Error ? e.message : String(e)}`;
      const s = useXYData.getState();
      useXYData.setState({
        messages: s.messages.map((m) =>
          m.id === placeholderId ? { ...m, text: errText, streaming: false } : m,
        ),
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
      installedStickerPackIds: [...DEFAULT_STICKER_PACK_IDS],
      userSettings: {
        nickname: '小星星',
        bio: '用星语，和偶像聊天吧～',
        accentColor: '#E8A0BF', // 默认粉色
        avatarUrl: '',
        coverUrl: '',
      },

      sendMessage: (convId, text) => {
        const msg = createUserMsg(convId, 'text', { text });
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

      sendImageMessage: (convId, imageUrl) => {
        const msg = createUserMsg(convId, 'image', { imageUrl });
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

      sendStickerMessage: (convId, stickerEmoji) => {
        const msg = createUserMsg(convId, 'sticker', { stickerEmoji });
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

      toggleLike: (momentId) =>
        set((s) => ({
          moments: s.moments.map((mo) =>
            mo.id === momentId
              ? { ...mo, liked: !mo.liked, likes: mo.liked ? mo.likes - 1 : mo.likes + 1 }
              : mo,
          ),
        })),

      installStickerPack: (packId) =>
        set((s) => ({
          installedStickerPackIds: s.installedStickerPackIds.includes(packId)
            ? s.installedStickerPackIds
            : [...s.installedStickerPackIds, packId],
        })),

      uninstallStickerPack: (packId) =>
        set((s) => ({
          installedStickerPackIds: s.installedStickerPackIds.filter((id) => id !== packId),
        })),

      addMoment: (text, imageUrl) => {
        const moment: Moment = {
          id: uid(),
          idolId: 'me',
          text,
          imageUrl,
          likes: 0,
          liked: false,
          timestamp: Date.now(),
          comments: [],
        };
        set((s) => ({ moments: [moment, ...s.moments] }));
      },

      addComment: (momentId, text) =>
        set((s) => ({
          moments: s.moments.map((mo) =>
            mo.id === momentId
              ? { ...mo, comments: [...mo.comments, { userId: 'me', text }] }
              : mo,
          ),
        })),

      updateSettings: (settings) =>
        set((s) => ({
          userSettings: { ...s.userSettings, ...settings },
        })),

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
    }),
    {
      name: 'hiPhone-xingyu',
      partialize: (s) => ({
        conversations: s.conversations,
        messages: s.messages,
        moments: s.moments,
        installedStickerPackIds: s.installedStickerPackIds,
        userSettings: s.userSettings,
      }),
    },
  ),
);
