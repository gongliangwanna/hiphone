import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Phone, Video, Send, Image, Smile, Search, X, Palette } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, formatChatTime, ME } from '../data';
import type { Message } from '../data';
import { Avatar } from '../components/Avatar';
import { StickerPicker } from '../components/StickerPicker';
import { ImagePicker } from '../components/ImagePicker';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { T, springs } from '../theme';

type PickerMode = 'none' | 'sticker' | 'image';

export function ChatDetail() {
  const activeChatId = useXYNav((s) => s.activeChatId);
  const closeChat = useXYNav((s) => s.closeChat);
  const openIdol = useXYNav((s) => s.openIdol);
  const conversations = useXYData((s) => s.conversations);
  const allMessages = useXYData((s) => s.messages);
  const sendMessage = useXYData((s) => s.sendMessage);
  const sendImageMessage = useXYData((s) => s.sendImageMessage);
  const sendStickerMessage = useXYData((s) => s.sendStickerMessage);
  const markRead = useXYData((s) => s.markRead);

  const [input, setInput] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('none');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrawing, setShowDrawing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conv = useMemo(
    () => conversations.find((c) => c.id === activeChatId),
    [conversations, activeChatId],
  );
  const idol = conv ? getIdol(conv.idolId) : undefined;

  const allConvMessages = useMemo(
    () =>
      activeChatId
        ? allMessages.filter((m) => m.convId === activeChatId).sort((a, b) => a.timestamp - b.timestamp)
        : [],
    [allMessages, activeChatId],
  );

  const messages = useMemo(() => {
    if (!searchQuery.trim()) return allConvMessages;
    const q = searchQuery.trim().toLowerCase();
    return allConvMessages.filter(
      (m) => m.text?.toLowerCase().includes(q) || m.stickerEmoji?.includes(q),
    );
  }, [allConvMessages, searchQuery]);

  useEffect(() => {
    if (activeChatId) markRead(activeChatId);
  }, [activeChatId, markRead]);

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !activeChatId) return;
    sendMessage(activeChatId, text);
    setInput('');
    setPickerMode('none');
  }, [input, activeChatId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSendImage = useCallback(
    (url: string) => {
      if (!activeChatId) return;
      sendImageMessage(activeChatId, url);
      setPickerMode('none');
    },
    [activeChatId, sendImageMessage],
  );

  const handleSendSticker = useCallback(
    (emoji: string) => {
      if (!activeChatId) return;
      sendStickerMessage(activeChatId, emoji);
      setPickerMode('none');
    },
    [activeChatId, sendStickerMessage],
  );

  const togglePicker = useCallback(
    (mode: PickerMode) => {
      setPickerMode((prev) => (prev === mode ? 'none' : mode));
      inputRef.current?.blur();
    },
    [],
  );

  const isGroup = idol?.isGroup ?? false;

  const handleSendDrawing = useCallback(
    (dataUrl: string) => {
      if (!activeChatId) return;
      sendImageMessage(activeChatId, dataUrl);
      setShowDrawing(false);
    },
    [activeChatId, sendImageMessage],
  );

  if (!conv || !idol) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* ── Header ── */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="flex items-center gap-2.5 px-2" style={{ height: 56 }}>
          <motion.button
            className="flex items-center justify-center"
            style={{ width: 36, height: 36 }}
            onClick={() => { searchMode ? (setSearchMode(false), setSearchQuery('')) : closeChat(); }}
            whileTap={{ scale: 0.85 }}
            transition={springs.press}
          >
            <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
          </motion.button>

          <motion.button
            onClick={() => openIdol(idol.id)}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar src={idol.avatar} size={32} ringIndex={idol.ringIndex} online={idol.online} />
          </motion.button>

          <motion.button
            className="flex min-w-0 flex-1 flex-col items-start"
            onClick={() => openIdol(idol.id)}
            whileTap={{ scale: 0.98 }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>
              {idol.name}
            </span>
            <span style={{ fontSize: 11, color: idol.online ? T.online : T.textMuted }}>
              {idol.online ? '在线' : '离线'}
            </span>
          </motion.button>

          <div className="flex items-center">
            <motion.button
              className="flex items-center justify-center"
              style={{ width: 36, height: 36 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setSearchMode((p) => !p); setSearchQuery(''); }}
            >
              <Search size={17} strokeWidth={1.8} color={searchMode ? T.accent : T.textSecondary} />
            </motion.button>
            <motion.button
              className="flex items-center justify-center"
              style={{ width: 36, height: 36 }}
              whileTap={{ scale: 0.85 }}
            >
              <Phone size={17} strokeWidth={1.8} color={T.textSecondary} />
            </motion.button>
            <motion.button
              className="flex items-center justify-center"
              style={{ width: 36, height: 36 }}
              whileTap={{ scale: 0.85 }}
            >
              <Video size={17} strokeWidth={1.8} color={T.textSecondary} />
            </motion.button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchMode && (
            <motion.div
              className="flex items-center gap-2 px-3 pb-2"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="flex min-w-0 flex-1 items-center gap-2"
                style={{
                  height: 34,
                  borderRadius: T.r.xl,
                  backgroundColor: T.card,
                  paddingLeft: 12,
                  paddingRight: 6,
                  border: `1px solid ${T.border}`,
                }}
              >
                <Search size={14} strokeWidth={1.8} color={T.textMuted} />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: T.textPrimary }}
                  placeholder="搜索消息..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
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
              {searchQuery && (
                <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' }}>
                  {messages.length} 条结果
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
        {messages.map((msg, i) => (
          <MsgBubble key={msg.id} msg={msg} idol={idol} prevMsg={messages[i - 1]} onAvatarTap={openIdol} />
        ))}
        {/* Typing dots when idol is online and last msg was mine */}
        {idol.online && messages.length > 0 && messages[messages.length - 1]?.senderId === 'me' && (
          <TypingDots avatarSrc={idol.avatar} ringIndex={idol.ringIndex} />
        )}
      </div>

      {/* ── Input ── */}
      <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          height: 56,
          borderTop: `0.5px solid ${T.separator}`,
          backgroundColor: T.overlay,
        }}
      >
        <motion.button
          className="flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            backgroundColor: pickerMode === 'image' ? `${T.accent}20` : 'transparent',
            borderRadius: T.r.sm,
          }}
          whileTap={{ scale: 0.85 }}
          onClick={() => togglePicker('image')}
        >
          <Image size={20} strokeWidth={1.6} color={pickerMode === 'image' ? T.accent : T.textMuted} />
        </motion.button>

        {isGroup && (
          <motion.button
            className="flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: T.r.sm,
            }}
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowDrawing(true)}
          >
            <Palette size={20} strokeWidth={1.6} color={T.textMuted} />
          </motion.button>
        )}

        <div
          className="flex min-w-0 flex-1 items-center"
          style={{
            height: 38,
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            paddingLeft: 14,
            paddingRight: 4,
            border: `1px solid ${T.border}`,
          }}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: T.textPrimary }}
            placeholder="说点什么..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setPickerMode('none')}
          />
          <AnimatePresence mode="wait">
            {input.trim() ? (
              <motion.button
                key="send"
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 30,
                  height: 30,
                  background: T.accentGrad,
                }}
                onClick={handleSend}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={springs.smooth}
              >
                <Send size={14} strokeWidth={2.2} color={T.textOnAccent} />
              </motion.button>
            ) : (
              <motion.button
                key="emoji"
                className="flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  backgroundColor: pickerMode === 'sticker' ? `${T.accent}20` : 'transparent',
                  borderRadius: T.r.full,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => togglePicker('sticker')}
              >
                <Smile size={20} strokeWidth={1.5} color={pickerMode === 'sticker' ? T.accent : T.textMuted} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Pickers ── */}
      <StickerPicker
        visible={pickerMode === 'sticker'}
        onSendSticker={handleSendSticker}
      />
      <ImagePicker
        visible={pickerMode === 'image'}
        onSelectImage={handleSendImage}
        onClose={() => setPickerMode('none')}
      />

      {/* ── Drawing Canvas (group chat only) ── */}
      {isGroup && (
        <DrawingCanvas
          visible={showDrawing}
          onSend={handleSendDrawing}
          onClose={() => setShowDrawing(false)}
        />
      )}
    </div>
  );
}

/* ── Bubble ── */

function MsgBubble({
  msg,
  idol,
  prevMsg,
  onAvatarTap,
}: {
  msg: Message;
  idol: { id: string; avatar: string; ringIndex: number };
  prevMsg?: Message;
  onAvatarTap: (id: string) => void;
}) {
  const isMine = msg.senderId === 'me';
  const showTime = !prevMsg || msg.timestamp - prevMsg.timestamp > 15 * 60_000;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      {showTime && (
        <div className="py-2.5 text-center">
          <span
            style={{
              fontSize: 11,
              color: T.textMuted,
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderRadius: T.r.sm,
              padding: '3px 10px',
            }}
          >
            {formatChatTime(msg.timestamp)}
          </span>
        </div>
      )}

      <div className={`mb-1.5 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        {!isMine && (
          <motion.button
            className="mr-2 mt-auto shrink-0"
            onClick={() => onAvatarTap(idol.id)}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar src={idol.avatar} size={28} ringIndex={idol.ringIndex} />
          </motion.button>
        )}

        <div style={{ maxWidth: msg.type === 'image' ? '58%' : '70%' }}>
          {msg.type === 'sticker' && msg.stickerEmoji && (
            <span style={{ fontSize: 40, display: 'block', textAlign: isMine ? 'right' : 'left' }}>
              {msg.stickerEmoji}
            </span>
          )}

          {msg.type === 'image' && msg.imageUrl && (
            <div
              style={{
                borderRadius: T.r.lg,
                overflow: 'hidden',
                boxShadow: T.shadow2,
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
                  aspectRatio: '1',
                  objectFit: 'cover',
                }}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
              />
            </div>
          )}

          {msg.type === 'text' && msg.text && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: T.r.xl,
                borderBottomRightRadius: isMine ? 6 : T.r.xl,
                borderBottomLeftRadius: isMine ? T.r.xl : 6,
                background: isMine ? T.accentGrad : T.card,
                color: isMine ? T.textOnAccent : T.textPrimary,
                boxShadow: T.shadow1,
                border: isMine ? 'none' : `1px solid ${T.border}`,
                fontSize: 15,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
            </div>
          )}
        </div>

        {isMine && (
          <motion.button
            className="ml-2 mt-auto shrink-0"
            onClick={() => onAvatarTap('me')}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar src={ME.avatar} size={28} ringIndex={0} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Typing ── */

function TypingDots({ avatarSrc, ringIndex }: { avatarSrc: string; ringIndex: number }) {
  return (
    <div className="mb-2 flex items-end gap-2">
      <Avatar src={avatarSrc} size={28} ringIndex={ringIndex} />
      <div
        className="flex items-center gap-1.5"
        style={{
          padding: '12px 16px',
          borderRadius: T.r.xl,
          borderBottomLeftRadius: 6,
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="rounded-full"
            style={{ width: 5, height: 5, backgroundColor: T.textMuted }}
            animate={{ y: [0, -4, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}
