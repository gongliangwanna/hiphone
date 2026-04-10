import { useMemo } from 'react';
import { UserPlus, Search, ArrowRight, Square } from 'lucide-react';
import { useSnapchatNavStore } from '../snapchatNavStore';
import { useSnapchatDataStore } from '../snapchatDataStore';
import { getUserById, formatTimeAgo } from '../data';
import type { Conversation, SnapStatus } from '../data';

/** Status indicator colors following Snapchat conventions */
const STATUS_COLORS = {
  snapSent: '#FF0000',
  snapReceived: '#FF0000',
  chatSent: '#8B5CF6',
  chatDelivered: '#3B82F6',
  opened: '#8E8E93',
  screenshot: '#22C55E',
} as const;

export function ChatTab() {
  const conversations = useSnapchatDataStore((s) => s.conversations);
  const openChat = useSnapchatNavStore((s) => s.openChat);
  const openSnap = useSnapchatNavStore((s) => s.openSnap);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime),
    [conversations],
  );

  const handleTap = (conv: Conversation) => {
    if (conv.unread && conv.contentType === 'snap' && conv.status === 'received') {
      const snapId = `snap-${conv.userId}`;
      openSnap(snapId);
    } else {
      openChat(conv.id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{ height: 56 }}
      >
        <button className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
          <UserPlus size={22} strokeWidth={1.8} color="#000" />
        </button>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#000' }}>
          Friends{' '}
          <span style={{ fontSize: 18 }}>&#x2728;</span>
        </span>
        <button className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
          <Search size={22} strokeWidth={1.8} color="#000" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {sorted.map((conv, i) => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            isLast={i === sorted.length - 1}
            onTap={() => handleTap(conv)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Conversation Row ── */

interface ConversationRowProps {
  conv: Conversation;
  isLast: boolean;
  onTap: () => void;
}

function ConversationRow({ conv, isLast, onTap }: ConversationRowProps) {
  const user = getUserById(conv.userId);
  if (!user) return null;

  const statusColor = getStatusColor(conv.status, conv.contentType);
  const statusText = conv.lastMessage;
  const timeText = formatTimeAgo(conv.lastMessageTime);
  const isUnreadSnap = conv.unread && conv.contentType === 'snap';
  const isAdMessage = conv.isAd && conv.contentType === 'chat' && conv.unread;

  return (
    <button
      className="flex w-full items-center px-4"
      style={{
        minHeight: 68,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
      }}
      onClick={onTap}
      data-testid={`snap-conv-${conv.id}`}
    >
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: user.avatarBg,
          fontSize: 22,
        }}
      >
        {user.avatarEmoji}
      </div>

      {/* Text content */}
      <div className="ml-3 flex min-w-0 flex-1 flex-col items-start">
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#000',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
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
        <span
          style={{
            fontSize: 13,
            color: isAdMessage || isUnreadSnap ? statusColor : 'var(--color-secondaryLabel)',
            fontWeight: conv.unread ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {isUnreadSnap ? (
            statusText
          ) : isAdMessage ? (
            <>{statusText}</>
          ) : (
            <>
              {statusText}
              <span style={{ color: 'var(--color-secondaryLabel)', fontWeight: 400 }}>
                {' '}
                · {timeText}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Status indicator */}
      <div className="ml-2 shrink-0">
        <StatusIndicator status={conv.status} contentType={conv.contentType} />
      </div>
    </button>
  );
}

/* ── Status Indicator ── */

function getStatusColor(status: SnapStatus, contentType: 'snap' | 'chat'): string {
  if (status === 'opened') return STATUS_COLORS.opened;
  if (status === 'screenshot') return STATUS_COLORS.screenshot;
  if (contentType === 'snap') return STATUS_COLORS.snapSent;
  if (status === 'chat') return STATUS_COLORS.chatSent;
  if (status === 'delivered') return STATUS_COLORS.chatDelivered;
  return STATUS_COLORS.chatSent;
}

function StatusIndicator({ status, contentType }: { status: SnapStatus; contentType: 'snap' | 'chat' }) {
  const color = getStatusColor(status, contentType);

  if (status === 'sent' || status === 'delivered' || status === 'chat') {
    return <ArrowRight size={16} strokeWidth={2} color={color} />;
  }

  if (status === 'received') {
    return <Square size={14} strokeWidth={0} color={color} fill={color} />;
  }

  if (status === 'opened') {
    return <Square size={14} strokeWidth={1.8} color={color} />;
  }

  return null;
}
