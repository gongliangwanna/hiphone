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

/* ── Auto-reply timers (module-level, not serializable) ── */
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface UserSettings {
  nickname: string;
  bio: string;
  accentColor: string;
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
}

function createUserMsg(
  convId: string,
  type: Message['type'],
  extra: Partial<Message>,
): Message {
  return {
    id: crypto.randomUUID(),
    convId,
    senderId: 'me',
    type,
    timestamp: Date.now(),
    ...extra,
  };
}

function scheduleIdolReply(convId: string, get: () => XingYuDataState) {
  if (replyTimers.has(convId)) clearTimeout(replyTimers.get(convId)!);

  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv) return;
  const idol = getIdol(conv.idolId);
  if (!idol?.online) return;

  const delay = 1500 + Math.random() * 2000;
  const timer = setTimeout(() => {
    const replies = IDOL_REPLY_POOL[conv.idolId];
    if (!replies?.length) return;
    const reply = replies[Math.floor(Math.random() * replies.length)]!;

    const msg: Message = {
      id: crypto.randomUUID(),
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
        accentColor: '#BA90C6',
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
          id: crypto.randomUUID(),
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
