import { useRef, useEffect } from 'react';
import { NavBar } from '@/system';
import { chatList, chatMessages, getAvatarColor, getAvatarInitial } from '../data';
import type { ChatMessage } from '../data';

interface ChatDetailProps {
  chatId: string;
  onBack: () => void;
}

export function ChatDetail({ chatId, onBack }: ChatDetailProps) {
  const chat = chatList.find((c) => c.id === chatId);
  const messages = chatMessages[chatId] ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const chatName = chat?.name ?? chatId;

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <NavBar title={chatName} showBack onBack={onBack} backLabel="微信" />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto" style={{ padding: '8px 12px' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} chatName={chatName} />
        ))}
      </div>

      {/* Input bar */}
      <div
        className="flex shrink-0 items-center gap-2"
        style={{
          padding: '8px 12px',
          borderTop: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-tertiarySystemBackground)',
        }}
      >
        <VoiceIcon />
        <div
          className="flex-1"
          style={{
            height: 36,
            borderRadius: 6,
            backgroundColor: 'var(--color-systemBackground)',
            border: '0.5px solid var(--color-separator)',
          }}
        />
        <StickerIcon />
        <PlusIcon />
      </div>
    </div>
  );
}

function MessageBubble({ message, chatName }: { message: ChatMessage; chatName: string }) {
  const isMe = message.sender === 'me';
  const avatarColor = isMe ? '#57BE6A' : getAvatarColor(chatName);
  const initial = isMe ? '我' : getAvatarInitial(chatName);

  return (
    <div
      className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ marginBottom: 12 }}
    >
      {/* Avatar */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
          backgroundColor: avatarColor,
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {initial}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '65%',
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: isMe ? '#95EC69' : 'var(--color-systemBackground)',
          color: 'var(--color-label)',
          fontSize: 'var(--font-size-body)',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

/* ── SF Symbol style input icons ── */

function VoiceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="9" y="3" width="6" height="10" rx="3" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" />
      <path d="M5 12a7 7 0 0014 0" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 19v3" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StickerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" />
      <path d="M8 9.5v1M16 9.5v1" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 14.5a5 5 0 008 0" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" />
      <path d="M12 7.5v9M7.5 12h9" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
