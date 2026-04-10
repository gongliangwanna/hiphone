import { useCallback } from 'react';
import { chatList, getAvatarColor, getAvatarInitial } from '../data';
import type { ChatItem } from '../data';

interface ChatsTabProps {
  onOpenChat: (chatId: string) => void;
}

export function ChatsTab({ onOpenChat }: ChatsTabProps) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-systemBackground)' }}>
      {/* Search bar */}
      <div style={{ padding: '8px 16px' }}>
        <div
          className="flex items-center justify-center"
          style={{
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-tertiaryLabel)',
            fontSize: 'var(--font-size-callout)',
          }}
        >
          <SearchIcon />
          <span style={{ marginLeft: 6 }}>搜索</span>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-auto">
        {chatList.map((chat) => (
          <ChatRow key={chat.id} chat={chat} onOpenChat={onOpenChat} />
        ))}
      </div>
    </div>
  );
}

function ChatRow({ chat, onOpenChat }: { chat: ChatItem; onOpenChat: (id: string) => void }) {
  const handleClick = useCallback(() => onOpenChat(chat.id), [chat.id, onOpenChat]);
  const avatarColor = getAvatarColor(chat.name);
  const initial = getAvatarInitial(chat.name);

  return (
    <button
      className="flex w-full items-center"
      style={{
        padding: '12px 16px',
        backgroundColor: chat.pinned ? 'var(--color-secondarySystemBackground)' : 'transparent',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
      onClick={handleClick}
    >
      {/* Avatar */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: chat.isService ? 6 : 22,
          backgroundColor: avatarColor,
          color: '#fff',
          fontSize: 16,
          fontWeight: 500,
        }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="ml-3 flex min-w-0 flex-1 flex-col items-start">
        <div className="flex w-full items-center justify-between">
          <span
            className="truncate"
            style={{
              fontSize: 'var(--font-size-body)',
              fontWeight: 500,
              color: 'var(--color-label)',
              maxWidth: '70%',
            }}
          >
            {chat.name}
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-caption1)',
              color: 'var(--color-tertiaryLabel)',
              flexShrink: 0,
            }}
          >
            {chat.time}
          </span>
        </div>
        <div className="flex w-full items-center justify-between" style={{ marginTop: 2 }}>
          <span
            className="truncate"
            style={{
              fontSize: 'var(--font-size-subhead)',
              color: 'var(--color-secondaryLabel)',
              maxWidth: chat.unread > 0 ? 'calc(100% - 30px)' : '100%',
            }}
          >
            {chat.lastMessage}
          </span>
          {chat.unread > 0 && (
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#F44336',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                paddingInline: 5,
              }}
            >
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
