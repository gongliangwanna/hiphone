import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Phone, Send, Image, Smile, Search, X, Palette } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, formatChatTime, DEFAULT_AVATAR } from '../data';
import type { Message } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';

/** Character 对话头像兜底路径,和 ContactsTab 保持一致 */
const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

/** ChatDetail 里用到的"聊天对象" shape,同时兼容 mock idol 和 CCV2 character */
interface ChatPeer {
  id: string;
  name: string;
  avatar: string;
  ringIndex: number;
  online: boolean;
  isGroup: boolean;
  memberCount?: number;
}
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
  // Dedup between pointerdown + click firing for the same tap on mobile.
  const lastSendAtRef = useRef(0);
  // True while user is actively touching the messages container — used to
  // suppress the ResizeObserver auto-snap that would otherwise yank
  // scrollTop back to the bottom mid-drag (the cause of "page jumps when
  // I drag down at the bottom of the chat" with the keyboard up).
  const userTouchingRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    // Land 1px short of the absolute max so iOS still considers the
    // container scrollable in BOTH directions. When scrollTop === max
    // exactly, iOS treats downward drags as overscroll → dismiss-keyboard,
    // and the page visibly bounces. The 1px gap is invisible but keeps
    // the scroll container "engaged" with iOS's gesture system.
    const max = el.scrollHeight - el.clientHeight;
    const target = Math.max(0, max - 1);
    el.scrollTo({ top: target, behavior });
  }, []);

  const conv = useMemo(
    () => conversations.find((c) => c.id === activeChatId),
    [conversations, activeChatId],
  );
  const characters = useCharacterStore((s) => s.characters);

  // 对话对端:character 优先,fallback 到 legacy mock idol
  const peer = useMemo<ChatPeer | undefined>(() => {
    if (!conv) return undefined;
    if (conv.characterId) {
      const ch = characters.find((c) => c.id === conv.characterId);
      if (!ch) return undefined;
      return {
        id: ch.id,
        name: ch.name,
        avatar: ch.avatar?.trim() || CHAR_FALLBACK_AVATAR,
        ringIndex: 0,
        online: true,
        isGroup: false,
      };
    }
    const idol = getIdol(conv.idolId);
    if (!idol) return undefined;
    return {
      id: idol.id,
      name: idol.name,
      avatar: idol.avatar,
      ringIndex: idol.ringIndex,
      online: idol.online,
      isGroup: idol.isGroup ?? false,
      memberCount: idol.memberCount,
    };
  }, [conv, characters]);

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

  // Auto-scroll to the latest message whenever message count changes OR when
  // the user switches conversations. Keyboard handling itself is done at the
  // shell level (Device.tsx mirrors the visual viewport); this hook just
  // guarantees the latest message stays in view on content changes.
  useEffect(() => {
    // rAF so layout has a chance to lay out any brand-new bubble first.
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [activeChatId, messages.length, scrollToBottom]);

  // ResizeObserver on the scroll container is the most reliable way to keep
  // the latest message pinned to the bottom through flex reflows: when the
  // keyboard opens/closes (Device shrinks → scroll container shrinks → RO
  // fires), or when the user rotates the device. Fires AFTER layout is
  // committed, so `scrollHeight` is accurate.
  //
  // BUT: if the user is actively touching the scroll container (e.g.
  // dragging to scroll older messages into view), we MUST NOT yank
  // scrollTop back to the bottom — that produces the "page jumps" the
  // user reported when dragging at the bottom of the chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (userTouchingRef.current) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: Math.max(0, max - 1), behavior: 'auto' });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-anchor to the latest message when the iOS keyboard opens or closes.
  // The ResizeObserver above already catches scroll-container size changes
  // from `--keyboard-height` updating padding-bottom, but vv.resize is the
  // earliest signal we get and it lets us land on the bottom in lockstep
  // with the keyboard animation, instead of one frame after the RO fires.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (userTouchingRef.current) return;
      // rAF lets the new padding-bottom commit to layout first.
      requestAnimationFrame(() => scrollToBottom('auto'));
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [scrollToBottom]);

  // Track touch state on the messages container so the ResizeObserver
  // above can bail out during user-initiated drags.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onStart = () => {
      userTouchingRef.current = true;
    };
    const onEnd = () => {
      // Slight delay so the resize that follows the touch (e.g. keyboard
      // settling) doesn't immediately re-snap to bottom.
      setTimeout(() => {
        userTouchingRef.current = false;
      }, 250);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const handleSend = useCallback(() => {
    // Dedup: on mobile the send button runs both pointerdown and click for a
    // single tap (hybrid listeners are the belt-and-suspenders fix for iOS
    // Safari where pointerdown preventDefault can suppress the synthetic click).
    const now = Date.now();
    if (now - lastSendAtRef.current < 400) return;
    lastSendAtRef.current = now;

    // Read live value from the input ref — IME composition on mobile can leave
    // the React state stale even though the visible text is already committed.
    const liveValue = inputRef.current?.value ?? input;
    const text = liveValue.trim();
    if (!text || !activeChatId) return;
    sendMessage(activeChatId, text);
    setInput('');
    setPickerMode('none');
    if (inputRef.current) inputRef.current.value = '';
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

  const isGroup = peer?.isGroup ?? false;

  const handleSendDrawing = useCallback(
    (dataUrl: string) => {
      if (!activeChatId) return;
      sendImageMessage(activeChatId, dataUrl);
      setShowDrawing(false);
    },
    [activeChatId, sendImageMessage],
  );

  if (!conv || !peer) return null;

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: T.bg }}
    >
      {/* ── Header ── */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: 'rgba(248,246,249,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
          zIndex: 10,
        }}
      >
        <div className="flex items-center justify-between px-2" style={{ height: 44 }}>
          <div className="flex w-1/4 items-center justify-start">
            <motion.button
              className="flex items-center justify-center gap-1"
              onClick={() => { searchMode ? (setSearchMode(false), setSearchQuery('')) : closeChat(); }}
              whileTap={{ opacity: 0.5 }}
              transition={{ duration: 0 }}
            >
              <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
              <span style={{ fontSize: 16, color: T.accent, marginLeft: -4 }}>消息</span>
            </motion.button>
          </div>

          <motion.button
            className="flex flex-1 flex-col items-center justify-center min-w-0 px-2"
            onClick={() => {
              // Character 对话没有 IdolProfile 页面,先不跳转
              if (!conv.characterId) openIdol(peer.id);
            }}
            whileTap={{ opacity: 0.5 }}
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate" style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
                {peer.name}
              </span>
              <div
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: peer.online ? T.online : T.textMuted,
                }}
              />
            </div>
            {peer.isGroup && (
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {peer.memberCount}人
              </span>
            )}
          </motion.button>

          <div className="flex w-1/4 items-center justify-end gap-1 pr-1">
            <motion.button
              className="flex items-center justify-center"
              style={{ width: 32, height: 32 }}
              whileTap={{ opacity: 0.5 }}
              onClick={() => { setSearchMode((p) => !p); setSearchQuery(''); }}
            >
              <Search size={18} strokeWidth={2} color={searchMode ? T.accent : T.textSecondary} />
            </motion.button>
            <motion.button
              className="flex items-center justify-center"
              style={{ width: 32, height: 32 }}
              whileTap={{ opacity: 0.5 }}
            >
              <Phone size={18} strokeWidth={2} color={T.textSecondary} />
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

      {/* ── Messages ──
          Messages stack from the top (WeChat/QQ-style block layout). A
          single message lives at the top of the container, not glued to
          the bottom. We do NOT use flex justify-end here — that would
          look wrong in the no-keyboard state.

          `paddingBottom` includes `var(--keyboard-height)` so that when
          the keyboard is up and there are enough messages to fill the
          viewport, the auto scroll-to-bottom lands the latest message
          above the (translated) input bar instead of behind the keyboard.
          For chats with only a few messages this padding just adds empty
          space below — `scrollHeight` stays equal to `clientHeight`, so
          the message stays at the top of the container and the empty
          padding sits below it. Either way the message is visible.

          Device.tsx maintains `--keyboard-height` based on visualViewport.
      */}
      <div
        ref={scrollRef}
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3"
        style={{
          // Don't bubble overscroll/scroll-chain to the page — keeps iOS
          // from interpreting downward drags at the chat bottom as a
          // dismiss-keyboard gesture (which used to make the whole page
          // visibly bounce down).
          overscrollBehavior: 'contain',
          // Restrict the OS gesture interpretation to vertical pan only,
          // so iOS doesn't treat the same drag as keyboard-dismiss.
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(0.5rem + var(--keyboard-height, 0px))',
        }}
      >
        {messages.map((msg, i) => (
          <MsgBubble
            key={msg.id}
            msg={msg}
            peer={peer}
            prevMsg={messages[i - 1]}
            onAvatarTap={conv.characterId ? undefined : openIdol}
          />
        ))}
        {/* Typing dots: character 流式空 placeholder,或 legacy idol online 且最后一条是自己发的 */}
        {(() => {
          const last = messages[messages.length - 1];
          if (!last) return null;
          const isCharStreaming = conv.characterId && last.streaming && !last.text;
          const isLegacyTyping =
            !conv.characterId && peer.online && last.senderId === 'me';
          if (!isCharStreaming && !isLegacyTyping) return null;
          return <TypingDots avatarSrc={peer.avatar} ringIndex={peer.ringIndex} />;
        })()}
      </div>

      {/* ── Input ──
          The `transform: translateY(calc(-1 * var(--keyboard-height)))`
          is the key to keeping the chat header visible when the keyboard
          opens. By visually hoisting the input above the keyboard ourselves,
          iOS sees `getBoundingClientRect()` of the focused input as already
          inside the visual viewport and does NOT auto-scroll the page —
          which is what was hiding the header before. The smooth easing
          curve matches iOS's keyboard animation timing.
      */}
      <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          minHeight: 56,
          paddingTop: 10,
          // 避开 iOS Home Indicator 手势区域（约 34px），否则手机上的发送按钮点不到
          paddingBottom:
            pickerMode === 'none'
              ? 'max(14px, calc(var(--safe-bottom, 0px) + 14px))'
              : 12,
          borderTop: `0.5px solid ${T.separator}`,
          backgroundColor: T.overlay,
          transform: 'translateY(calc(-1 * var(--keyboard-height, 0px)))',
          transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        <button
          type="button"
          className="flex shrink-0 items-center justify-center transition-transform active:scale-90"
          style={{
            width: 44,
            height: 44,
            backgroundColor: pickerMode === 'image' ? `${T.accent}20` : 'transparent',
            borderRadius: T.r.sm,
            touchAction: 'manipulation',
          }}
          // 在 pointerdown 里直接触发 — 在 iOS Safari 上，pointerdown preventDefault
          // 可能会抑制后续合成的 click 事件（用户看到按钮有反馈但 onClick 收不到）。
          // 所以我们把动作挪到 pointerdown 本身，并且仍然 preventDefault 保持 input 不失焦。
          onPointerDown={(e) => {
            e.preventDefault();
            togglePicker('image');
          }}
        >
          <Image size={22} strokeWidth={1.8} color={pickerMode === 'image' ? T.accent : T.textMuted} />
        </button>

        {isGroup && (
          <button
            type="button"
            className="flex shrink-0 items-center justify-center transition-transform active:scale-90"
            style={{
              width: 44,
              height: 44,
              borderRadius: T.r.sm,
              touchAction: 'manipulation',
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              setShowDrawing(true);
            }}
          >
            <Palette size={22} strokeWidth={1.8} color={T.textMuted} />
          </button>
        )}

        <div
          className="flex min-w-0 flex-1 items-center gap-1"
          style={{
            minHeight: 40,
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
            style={{ fontSize: 16, color: T.textPrimary, height: 36 }}
            placeholder="说点什么..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setPickerMode('none');
              // Immediately jump to the latest message so the user isn't
              // left staring at older history when they tap the input.
              // rAF lets the layout settle if the keyboard triggers a reflow.
              requestAnimationFrame(() => scrollToBottom('auto'));
            }}
            enterKeyHint="send"
          />
          {input.trim() ? (
            <button
              key="send"
              type="button"
              className="flex shrink-0 items-center justify-center transition-transform active:scale-90"
              style={{
                // 44x44 tap target per iOS HIG; visual circle is 36x36 inside.
                width: 44,
                height: 44,
                borderRadius: T.r.full,
                backgroundColor: 'transparent',
                touchAction: 'manipulation',
                // iOS Safari: the tap hit area includes a little padding so
                // fingers that land slightly off still register.
                padding: 0,
              }}
              // Hybrid: pointerdown fires before any focus/blur race on mobile,
              // click is a belt-and-suspenders fallback. dedup in handleSend.
              onPointerDown={(e) => {
                e.preventDefault(); // keep input focused, no keyboard flicker
                handleSend();
              }}
              onClick={handleSend}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: T.accentGrad,
                  pointerEvents: 'none', // let the tap always hit the button
                }}
              >
                <Send size={16} strokeWidth={2.4} color={T.textOnAccent} />
              </span>
            </button>
          ) : (
            <button
              key="emoji"
              type="button"
              className="flex shrink-0 items-center justify-center transition-transform active:scale-90"
              style={{
                width: 44,
                height: 44,
                backgroundColor: pickerMode === 'sticker' ? `${T.accent}20` : 'transparent',
                borderRadius: T.r.full,
                touchAction: 'manipulation',
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                togglePicker('sticker');
              }}
            >
              <Smile size={22} strokeWidth={1.8} color={pickerMode === 'sticker' ? T.accent : T.textMuted} />
            </button>
          )}
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
  peer,
  prevMsg,
  onAvatarTap,
}: {
  msg: Message;
  peer: { id: string; avatar: string; ringIndex: number };
  prevMsg?: Message;
  /** undefined → 点头像不可跳转(character 对话暂不支持 IdolProfile) */
  onAvatarTap?: (id: string) => void;
}) {
  const isMine = msg.senderId === 'me';
  const showTime = !prevMsg || msg.timestamp - prevMsg.timestamp > 15 * 60_000;
  const [imgLoaded, setImgLoaded] = useState(false);
  const userSettings = useXYData((s) => s.userSettings);

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

      <div className={`mb-1.5 flex items-start ${isMine ? 'justify-end' : 'justify-start'}`}>
        {!isMine && (
          <motion.button
            className="mr-2 shrink-0"
            onClick={() => onAvatarTap?.(peer.id)}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar src={peer.avatar} size={36} ringIndex={peer.ringIndex} />
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
                borderTopRightRadius: isMine ? 6 : T.r.xl,
                borderTopLeftRadius: isMine ? T.r.xl : 6,
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
            className="ml-2 shrink-0"
            onClick={() => onAvatarTap?.('me')}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar src={userSettings.avatarUrl || DEFAULT_AVATAR} size={28} ringIndex={0} />
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
