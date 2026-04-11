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
    <div className="flex h-full flex-col bg-white relative">
      {/* Header */}
      <div
        className="shrink-0 px-4 pt-2 pb-2"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2.5"
          style={{
            height: 36,
            borderRadius: 12,
            backgroundColor: T.bg,
            paddingLeft: 12,
            paddingRight: 8,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <Search size={16} strokeWidth={2.5} color={T.textMuted} />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: T.textPrimary, fontWeight: 500 }}
            placeholder="搜索信件..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center justify-center rounded-full"
                style={{ width: 20, height: 20, backgroundColor: T.textMuted }}
                onClick={() => setQuery('')}
              >
                <X size={12} strokeWidth={2.5} color="#fff" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Conversation list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-white">
        {filtered.length === 0 && query.trim() ? (
          <motion.div 
            className="flex flex-col items-center py-20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span style={{ fontSize: 40, marginBottom: 12 }}>📭</span>
            <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>没有找到相关信件</span>
          </motion.div>
        ) : (
          filtered.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ...springs.gentle }}
            >
              <ConvRow conv={conv} onTap={() => openChat(conv.id)} />
            </motion.div>
          ))
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

function ConvRow({ conv, onTap }: { conv: Conversation; onTap: () => void }) {
  const idol = getIdol(conv.idolId);
  if (!idol) return null;

  return (
    <motion.button
      className="flex w-full items-center gap-3.5 relative"
      style={{
        padding: '12px 16px',
        backgroundColor: conv.unread > 0 ? T.bg : 'transparent',
      }}
      onClick={onTap}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
      transition={{ duration: 0 }}
    >
      <div className="relative">
        <Avatar
          src={idol.avatar}
          size={50}
          ringIndex={idol.ringIndex}
          online={idol.online}
        />
        {conv.unread > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full"
            style={{
              width: 18,
              height: 18,
              backgroundColor: T.accent,
              border: '2px solid #fff',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {conv.unread > 99 ? '99+' : conv.unread}
          </motion.div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 py-1">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
              {idol.name}
            </span>
            {idol.isGroup && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.accent,
                  background: 'rgba(255,174,201,0.15)',
                  borderRadius: T.r.xs,
                  padding: '2px 6px',
                }}
              >
                {idol.memberCount}人
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {conv.pinned && <Pin size={12} strokeWidth={2.5} color={T.textMuted} />}
            <span style={{ fontSize: 12, fontWeight: 500, color: conv.unread > 0 ? T.accent : T.textMuted }}>
              {formatTime(conv.lastTime)}
            </span>
          </div>
        </div>
        <span
          className="truncate"
          style={{
            fontSize: 14,
            color: conv.unread > 0 ? T.textPrimary : T.textSecondary,
            fontWeight: conv.unread > 0 ? 500 : 400,
            maxWidth: '100%',
            lineHeight: 1.4,
          }}
        >
          {conv.lastMsg}
        </span>
      </div>
      
      {/* iOS style separator */}
      <div 
        className="absolute bottom-0 right-0" 
        style={{ 
          height: 0.5, 
          backgroundColor: T.separator, 
          left: 80 // aligns with text
        }} 
      />
    </motion.button>
  );
}
