import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Search, X } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, formatChatTime } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { T, springs } from '../theme';

export function ChatSearch() {
  const activeChatId = useXYNav((s) => s.activeChatId);
  const closeChatSearch = useXYNav((s) => s.closeChatSearch);
  const closeChatSearchToMessage = useXYNav((s) => s.closeChatSearchToMessage);
  const conversations = useXYData((s) => s.conversations);
  const allMessages = useXYData((s) => s.messages);
  const characters = useCharacterStore((s) => s.characters);

  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Delay focus until after page transition animation to avoid keyboard lag
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const conv = useMemo(
    () => conversations.find((c) => c.id === activeChatId),
    [conversations, activeChatId],
  );

  // Peer display name for search results
  const peerName = useMemo(() => {
    if (!conv) return '';
    if (conv.remarkName) return conv.remarkName;
    if (conv.groupName) return conv.groupName;
    if (conv.characterId) {
      const ch = characters.find((c) => c.id === conv.characterId);
      return ch?.name ?? '';
    }
    return getIdol(conv.idolId)?.name ?? '';
  }, [conv, characters]);

  // Search results: filter current conversation's messages
  const searchResults = useMemo(() => {
    if (!activeChatId || !searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return allMessages
      .filter((m) => m.convId === activeChatId)
      .filter((m) => m.text?.toLowerCase().includes(q) || m.stickerDesc?.toLowerCase().includes(q))
      .sort((a, b) => b.timestamp - a.timestamp); // newest first
  }, [allMessages, activeChatId, searchQuery]);

  if (!conv) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header with search input */}
      <div
        className="flex shrink-0 items-center gap-2 px-2"
        style={{
          height: 56,
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex shrink-0 items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeChatSearch}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>

        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          style={{
            height: 36,
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            paddingLeft: 12,
            paddingRight: 6,
            border: `1px solid ${T.border}`,
          }}
        >
          <Search size={14} strokeWidth={1.8} color={T.textMuted} />
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 13, color: T.textPrimary }}
            placeholder="搜索聊天记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 18, height: 18, backgroundColor: T.textMuted }}
              onClick={() => setSearchQuery('')}
            >
              <X size={10} strokeWidth={2.5} color={T.card} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {!searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center pt-20" style={{ color: T.textMuted }}>
            <Search size={40} strokeWidth={1.2} color={T.border} />
            <p className="mt-3" style={{ fontSize: 13 }}>输入关键词搜索聊天记录</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20" style={{ color: T.textMuted }}>
            <p style={{ fontSize: 13 }}>没有找到相关消息</p>
          </div>
        ) : (
          <div className="px-4 pt-2">
            <span className="px-1" style={{ fontSize: 11, color: T.textMuted }}>
              {searchResults.length} 条结果
            </span>
            {searchResults.map((msg) => {
              const isMine = msg.senderId === 'me';
              const senderName = isMine ? '我' : peerName;
              const preview = (msg.text || msg.stickerDesc || '').slice(0, 60);
              return (
                <motion.button
                  key={msg.id}
                  className="flex w-full flex-col items-start"
                  style={{
                    padding: '12px 4px',
                    borderBottom: `0.5px solid ${T.separator}`,
                  }}
                  onClick={() => closeChatSearchToMessage(msg.id)}
                  whileTap={{ scale: 0.98, opacity: 0.7 }}
                >
                  <div className="flex w-full items-center justify-between">
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                      {senderName}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      {formatChatTime(msg.timestamp)}
                    </span>
                  </div>
                  <HighlightText
                    text={preview}
                    query={searchQuery.trim()}
                  />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Search result keyword highlight ── */

function HighlightText({ text, query }: { text: string; query: string }) {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) {
    return <span style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{text}</span>;
  }
  return (
    <span style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
      {text.slice(0, idx)}
      <span style={{ color: T.accent, fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  );
}
