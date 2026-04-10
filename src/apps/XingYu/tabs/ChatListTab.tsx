import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Pin, X } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, formatTime } from '../data';
import type { Conversation } from '../data';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

export function ChatListTab() {
  const conversations = useXYData((s) => s.conversations);
  const allMessages = useXYData((s) => s.messages);
  const openChat = useXYNav((s) => s.openChat);
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.lastTime - a.lastTime;
      }),
    [conversations],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter((conv) => {
      const idol = getIdol(conv.idolId);
      if (idol?.name.toLowerCase().includes(q)) return true;
      if (conv.lastMsg.toLowerCase().includes(q)) return true;
      // Search message content
      const msgs = allMessages.filter((m) => m.convId === conv.id);
      return msgs.some((m) => m.text?.toLowerCase().includes(q));
    });
  }, [sorted, query, allMessages]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div className="shrink-0 px-5 pt-3 pb-1">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.5 }}>
          消息
        </h1>
        {/* Search */}
        <div
          className="mt-3 flex items-center gap-2.5"
          style={{
            height: 40,
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            paddingLeft: 14,
            paddingRight: 8,
            boxShadow: T.shadowInset,
            border: `1px solid ${T.border}`,
          }}
        >
          <Search size={15} strokeWidth={1.8} color={T.textMuted} />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 14, color: T.textPrimary }}
            placeholder="搜索聊天、消息..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center justify-center rounded-full"
                style={{ width: 20, height: 20, backgroundColor: T.textMuted }}
                onClick={() => setQuery('')}
              >
                <X size={12} strokeWidth={2.5} color={T.card} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Conversation list */}
      <div className="scrollbar-hide mt-3 min-h-0 flex-1 overflow-y-auto px-4">
        {filtered.length === 0 && query.trim() ? (
          <div className="flex flex-col items-center py-12">
            <span style={{ fontSize: 13, color: T.textMuted }}>没有找到相关结果</span>
          </div>
        ) : (
          filtered.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, ...springs.gentle }}
            >
              <ConvRow conv={conv} onTap={() => openChat(conv.id)} />
            </motion.div>
          ))
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function ConvRow({ conv, onTap }: { conv: Conversation; onTap: () => void }) {
  const idol = getIdol(conv.idolId);
  if (!idol) return null;

  return (
    <motion.button
      className="flex w-full items-center gap-3"
      style={{
        padding: '12px 14px',
        marginBottom: 4,
        borderRadius: T.r.lg,
        backgroundColor: T.card,
        boxShadow: conv.unread > 0 ? T.shadow2 : T.shadow1,
        border: `1px solid ${conv.unread > 0 ? T.border : 'transparent'}`,
        transition: 'box-shadow 0.2s',
      }}
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      transition={springs.press}
    >
      <Avatar
        src={idol.avatar}
        size={44}
        ringIndex={idol.ringIndex}
        online={idol.online}
        unread={conv.unread}
      />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
              {idol.name}
            </span>
            {idol.isGroup && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: T.textSecondary,
                  background: `${T.accent}12`,
                  borderRadius: T.r.xs,
                  padding: '1px 5px',
                }}
              >
                {idol.memberCount}人
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {conv.pinned && <Pin size={10} strokeWidth={2} color={T.textMuted} />}
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {formatTime(conv.lastTime)}
            </span>
          </div>
        </div>
        <span
          className="truncate"
          style={{
            fontSize: 13,
            color: T.textMuted,
            fontWeight: conv.unread > 0 ? 500 : 400,
            maxWidth: '100%',
            lineHeight: 1.2,
          }}
        >
          {conv.lastMsg}
        </span>
      </div>
    </motion.button>
  );
}
