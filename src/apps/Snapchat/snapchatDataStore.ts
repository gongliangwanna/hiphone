import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { uid } from '@/platform/utils/uid';
import type { Conversation, ChatMessage } from './data';
import { SEED_CONVERSATIONS, SEED_MESSAGES } from './data';

interface SnapchatDataState {
  conversations: Conversation[];
  messages: ChatMessage[];

  sendMessage: (conversationId: string, text: string) => void;
  markAsRead: (conversationId: string) => void;
}

export const useSnapchatDataStore = create<SnapchatDataState>()(
  persist(
    (set) => ({
      conversations: SEED_CONVERSATIONS,
      messages: SEED_MESSAGES,

      sendMessage: (conversationId, text) => {
        const msg: ChatMessage = {
          id: uid(),
          conversationId,
          senderId: 'me',
          text,
          type: 'chat',
          timestamp: Date.now(),
          isRead: true,
        };
        set((state) => ({
          messages: [...state.messages, msg],
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: text, lastMessageTime: Date.now(), status: 'sent' as const, unread: false }
              : c,
          ),
        }));
      },

      markAsRead: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, unread: false } : c,
          ),
        }));
      },
    }),
    {
      name: 'hiPhone-snapchat',
      storage: idbStorage,
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages,
      }),
    },
  ),
);

/** Selector: messages for a specific conversation, sorted by time */
export function selectConversationMessages(state: SnapchatDataState, conversationId: string): ChatMessage[] {
  return state.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.timestamp - b.timestamp);
}
