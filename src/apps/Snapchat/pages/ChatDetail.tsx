import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, Video, Phone, MoreHorizontal, Camera, Image, Smile, Sticker, Send } from 'lucide-react';
import { useSnapchatNavStore } from '../snapchatNavStore';
import { useSnapchatDataStore } from '../snapchatDataStore';
import { getUserById, formatTimeAgo } from '../data';
import { usePerspective } from '@/platform/hooks/usePerspective';
import type { ChatMessage } from '../data';

const SENT_BUBBLE = '#007AFF';
const RECEIVED_BUBBLE = '#E5E5EA';

export function ChatDetail() {
  const activeChatId = useSnapchatNavStore((s) => s.activeChatId);
  const closeChat = useSnapchatNavStore((s) => s.closeChat);
  const conversations = useSnapchatDataStore((s) => s.conversations);
  const allMessages = useSnapchatDataStore((s) => s.messages);
  const sendMessage = useSnapchatDataStore((s) => s.sendMessage);
  const markAsRead = useSnapchatDataStore((s) => s.markAsRead);

  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conv = useMemo(
    () => conversations.find((c) => c.id === activeChatId),
    [conversations, activeChatId],
  );
  const user = conv ? getUserById(conv.userId) : undefined;

  const messages = useMemo(
    () => (activeChatId
      ? allMessages
          .filter((m) => m.conversationId === activeChatId)
          .sort((a, b) => a.timestamp - b.timestamp)
      : []),
    [allMessages, activeChatId],
  );

  useEffect(() => {
    if (activeChatId) markAsRead(activeChatId);
  }, [activeChatId, markAsRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !activeChatId) return;
    sendMessage(activeChatId, text);
    setInputText('');
  }, [inputText, activeChatId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!conv || !user) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{ height: 56, borderBottom: '0.5px solid var(--color-separator)' }}
      >
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeChat}
          data-testid="snap-chat-back"
        >
          <ChevronLeft size={24} strokeWidth={2} color="#000" />
        </button>

        {/* Avatar */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: user.avatarBg,
            fontSize: 16,
          }}
        >
          {user.avatarEmoji}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 16, fontWeight: 700, color: '#000' }}>
              {user.displayName}
            </span>
            {conv.isAd && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: '#8E8E93',
                  backgroundColor: '#E5E5EA',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                Ad
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
            <Video size={20} strokeWidth={1.8} color="#000" />
          </button>
          <button className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
            <Phone size={20} strokeWidth={1.8} color="#000" />
          </button>
          <button className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
            <MoreHorizontal size={20} strokeWidth={1.8} color="#000" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            showTimestamp={shouldShowTimestamp(messages, i)}
          />
        ))}
      </div>

      {/* Input bar */}
      <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          height: 52,
          borderTop: '0.5px solid var(--color-separator)',
          backgroundColor: '#fff',
        }}
      >
        <button className="flex items-center justify-center" style={{ width: 32, height: 32 }}>
          <Camera size={22} strokeWidth={1.8} color="#8E8E93" />
        </button>
        <button className="flex items-center justify-center" style={{ width: 32, height: 32 }}>
          <Image size={22} strokeWidth={1.8} color="#8E8E93" />
        </button>
        <div
          className="flex min-w-0 flex-1 items-center"
          style={{
            height: 36,
            borderRadius: 18,
            backgroundColor: '#F1F1F1',
            paddingLeft: 12,
            paddingRight: 4,
          }}
        >
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: '#000' }}
            placeholder="Send a chat..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="snap-chat-input"
          />
          {inputText.trim() && (
            <button
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: SENT_BUBBLE,
              }}
              onClick={handleSend}
              data-testid="snap-chat-send"
            >
              <Send size={14} strokeWidth={2} color="#fff" />
            </button>
          )}
        </div>
        <button className="flex items-center justify-center" style={{ width: 32, height: 32 }}>
          <Sticker size={22} strokeWidth={1.8} color="#8E8E93" />
        </button>
        <button className="flex items-center justify-center" style={{ width: 32, height: 32 }}>
          <Smile size={22} strokeWidth={1.8} color="#8E8E93" />
        </button>
      </div>
    </div>
  );
}

/* ── Message Bubble ── */

function MessageBubble({ msg, showTimestamp }: { msg: ChatMessage; showTimestamp: boolean }) {
  const { isSelf } = usePerspective();
  const isMine = isSelf(msg.senderId);
  const sender = getUserById(msg.senderId);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div>
      {showTimestamp && (
        <div className="py-2 text-center" style={{ fontSize: 11, color: 'var(--color-secondaryLabel)' }}>
          {formatTimeAgo(msg.timestamp)}
        </div>
      )}
      <div
        className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
      >
        {!isMine && sender && (
          <div
            className="mr-1.5 mt-auto shrink-0 flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: sender.avatarBg,
              fontSize: 12,
            }}
          >
            {sender.avatarEmoji}
          </div>
        )}
        <div style={{ maxWidth: msg.imageUrl ? '65%' : '75%' }}>
          {msg.imageUrl && (
            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#E5E5EA',
                marginBottom: msg.text ? 4 : 0,
              }}
            >
              <img
                src={msg.imageUrl}
                alt=""
                className="block w-full"
                style={{
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s',
                  aspectRatio: '3/4',
                  objectFit: 'cover',
                }}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
              />
            </div>
          )}
          {msg.text && (
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 18,
                borderBottomRightRadius: isMine ? 4 : 18,
                borderBottomLeftRadius: isMine ? 18 : 4,
                backgroundColor: isMine ? SENT_BUBBLE : RECEIVED_BUBBLE,
                color: isMine ? '#fff' : '#000',
                fontSize: 15,
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {isMine && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
                  ME
                </div>
              )}
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Show timestamp if >30 min gap between messages */
function shouldShowTimestamp(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const cur = messages[index];
  const prev = messages[index - 1];
  if (!cur || !prev) return true;
  return cur.timestamp - prev.timestamp > 30 * 60 * 1000;
}
