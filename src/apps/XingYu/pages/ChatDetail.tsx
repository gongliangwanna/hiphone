import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Phone, Send, Image, Smile, Palette, MoreHorizontal, Play } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { GroupMemberStrip } from '../components/GroupMemberStrip';
import { getIdol, formatChatTime, DEFAULT_AVATAR } from '../data';
import type { Message, QuoteRef } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useNotesNavStore } from '@/apps/Notes/notesNavStore';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { useToastStore } from '@/system';
import { MessageActionBar, type ActionType } from '../components/MessageActionBar';
import { QuotePreview, getQuotePreviewText } from '../components/QuotePreview';
import { QuoteBlock } from '../components/QuoteBlock';
import { MultiSelectToolbar } from '../components/MultiSelectToolbar';
import { ForwardCardBubble } from '../components/ForwardCardBubble';
import { Check } from 'lucide-react';

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
  const openStickerManager = useXYNav((s) => s.openStickerManager);
  const openChatSettings = useXYNav((s) => s.openChatSettings);
  const conversations = useXYData((s) => s.conversations);
  const allMessages = useXYData((s) => s.messages);
  const sendMessage = useXYData((s) => s.sendMessage);
  const sendImageMessage = useXYData((s) => s.sendImageMessage);
  const sendStickerMessage = useXYData((s) => s.sendStickerMessage);
  const markRead = useXYData((s) => s.markRead);
  const addFavorite = useXYData((s) => s.addFavorite);
  const addFavorites = useXYData((s) => s.addFavorites);
  const deleteMessages = useXYData((s) => s.deleteMessages);

  const scrollToMessageId = useXYNav((s) => s.scrollToMessageId);
  const clearScrollToMessage = useXYNav((s) => s.clearScrollToMessage);

  const [input, setInput] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('none');
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const [showDrawing, setShowDrawing] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ msgId: string; position: 'above' | 'below' } | null>(null);
  const [quoteMsg, setQuoteMsg] = useState<Message | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Dedup between pointerdown + click firing for the same tap on mobile.
  const lastSendAtRef = useRef(0);
  // Pagination: only render the most recent PAGE_SIZE messages initially.
  const PAGE_SIZE = 50;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const prevScrollHeightRef = useRef(0);
  // Track which message IDs have been rendered before — only new ones animate.
  // null = initial load (nothing animates), Set = subsequent renders.
  const seenMsgIdsRef = useRef<Set<string> | null>(null);
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
  const { phoneOwnerId, isViewingOther } = usePerspective();
  const persona = usePersonaStore((s) => s.getActivePersona());
  const userSettings = useXYData((s) => s.userSettings);

  // Group manual-reply serial lock — subscribe via state so the spinner
  // updates the moment the lock is released in scheduleAICharacterReply's
  // .finally(), not on the next unrelated re-render.
  const generatingByConv = useXYData((s) => s.generatingByConv);
  const generatingMemberId = conv?.groupMemberIds ? generatingByConv[conv.id] ?? null : null;
  const triggerGroupReply = useXYData((s) => s.triggerGroupReply);

  // 对话对端:character 优先,fallback 到 legacy mock idol
  // 查手机模式下需要视角化: AI 的对方是玩家
  const peer = useMemo<ChatPeer | undefined>(() => {
    if (!conv) return undefined;
    // AI-to-AI 会话
    if (conv.aiChatParticipants) {
      const [id1, id2] = conv.aiChatParticipants;
      const ch1 = characters.find((c) => c.id === id1);
      const ch2 = characters.find((c) => c.id === id2);
      // 查手机模式: 对方是另一个 AI
      if (phoneOwnerId) {
        const otherId = id1 === phoneOwnerId ? id2 : id1;
        const other = characters.find((c) => c.id === otherId);
        return {
          id: otherId,
          name: other?.name ?? '?',
          avatar: other?.avatar?.trim() || CHAR_FALLBACK_AVATAR,
          ringIndex: 0,
          online: true,
          isGroup: false,
        };
      }
      return {
        id: id1,
        name: `${ch1?.name ?? '?'} & ${ch2?.name ?? '?'}`,
        avatar: ch1?.avatar?.trim() || CHAR_FALLBACK_AVATAR,
        ringIndex: 0,
        online: true,
        isGroup: false,
      };
    }
    // 用户自建群聊
    if (conv.groupName && conv.groupMemberIds) {
      return {
        id: conv.id,
        name: conv.groupName,
        avatar: conv.groupAvatar?.trim() || '/resource/avatars/idol-starlight.jpg',
        ringIndex: 0,
        online: true,
        isGroup: true,
        memberCount: conv.groupMemberIds.length,
      };
    }
    if (conv.characterId) {
      // 查手机模式: AI 的对话对方是玩家
      if (phoneOwnerId && conv.characterId === phoneOwnerId) {
        return {
          id: 'me',
          name: persona?.name || userSettings.nickname || '用户',
          avatar: persona?.avatar || userSettings.avatarUrl || CHAR_FALLBACK_AVATAR,
          ringIndex: 0,
          online: true,
          isGroup: false,
        };
      }
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
  }, [conv, characters, phoneOwnerId, persona, userSettings]);

  // AI-AI 会话：构造双方 peer 信息供 MsgBubble 区分左右
  // 查手机模式下 phone owner 在右侧（自己的消息靠右）
  const aiChatPeers = useMemo<AIChatPeers | undefined>(() => {
    if (!conv?.aiChatParticipants) return undefined;
    const [id1, id2] = conv.aiChatParticipants;
    const ch1 = characters.find((c) => c.id === id1);
    const ch2 = characters.find((c) => c.id === id2);
    const s1 = `char-${id1}`;
    const s2 = `char-${id2}`;
    // 查手机模式: phone owner 在右侧
    const rightSenderId = phoneOwnerId
      ? (id1 === phoneOwnerId ? s1 : s2)
      : s2; // 默认 second participant on right
    return {
      rightSenderId,
      peers: {
        [s1]: { avatar: ch1?.avatar?.trim() || CHAR_FALLBACK_AVATAR, ringIndex: 0 },
        [s2]: { avatar: ch2?.avatar?.trim() || CHAR_FALLBACK_AVATAR, ringIndex: 0 },
      },
    };
  }, [conv, characters, phoneOwnerId]);

  const allConvMessages = useMemo(
    () =>
      activeChatId
        ? allMessages.filter((m) => m.convId === activeChatId).sort((a, b) => a.timestamp - b.timestamp)
        : [],
    [allMessages, activeChatId],
  );

  // Paginated slice: show last N messages.
  const visibleMessages = useMemo(
    () => allConvMessages.slice(-displayCount),
    [allConvMessages, displayCount],
  );

  const hasMore = allConvMessages.length > displayCount;

  // Reset pagination & animation tracking when switching chats.
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    seenMsgIdsRef.current = null;
    setActionMenu(null);
    setQuoteMsg(null);
    setMultiSelectMode(false);
    setSelectedMsgIds(new Set());
  }, [activeChatId]);

  // Track seen message IDs for animation control.
  useEffect(() => {
    if (seenMsgIdsRef.current === null) {
      // First render after chat open: mark all visible messages as seen (no animation).
      seenMsgIdsRef.current = new Set(visibleMessages.map((m) => m.id));
    } else {
      visibleMessages.forEach((m) => seenMsgIdsRef.current!.add(m.id));
    }
  }, [visibleMessages]);

  // Load older messages when scrolling to top.
  const loadMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
    // Pre-mark all conversation messages as seen so loaded messages don't animate.
    if (seenMsgIdsRef.current) {
      allConvMessages.forEach((m) => seenMsgIdsRef.current!.add(m.id));
    }
    setDisplayCount((c) => Math.min(c + PAGE_SIZE, allConvMessages.length));
  }, [allConvMessages]);

  // Preserve scroll position after loading older messages.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !prevScrollHeightRef.current) return;
    const diff = el.scrollHeight - prevScrollHeightRef.current;
    if (diff > 0) el.scrollTop += diff;
    prevScrollHeightRef.current = 0;
  }, [displayCount]);

  // IntersectionObserver on sentinel to trigger loadMore.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) loadMore(); },
      { root: scrollRef.current, rootMargin: '200px 0px 0px 0px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    if (activeChatId) markRead(activeChatId);
  }, [activeChatId, markRead]);

  // 最后一条消息的文本长度 — 用于在 AI 流式输出时触发自动滚动。
  // messages.length 只在数组增减时变化,而流式回复是"先插一条空 placeholder
  // 再往里 append text",长度不变,老的 effect 只在插入那一刻滚了一次,
  // 之后气泡越长越多行,用户就看不到后半截了。把文本长度也加入依赖,
  // 每个 token 都会触发 scrollToBottom,把视图钉在底部。
  const lastMsg = allConvMessages[allConvMessages.length - 1];
  const lastMsgTextLen =
    lastMsg && (lastMsg.type === 'text' || lastMsg.type === 'heartbeat_log')
      ? lastMsg.text.length
      : 0;

  // Auto-scroll to the latest message whenever message count changes, the
  // streaming text grows, OR when the user switches conversations.
  // Skip when we are scrolling to (or just scrolled to) a specific target message.
  const scrollingToTargetRef = useRef(false);
  useEffect(() => {
    if (scrollToMessageId || scrollingToTargetRef.current) return;
    // rAF so layout has a chance to lay out any brand-new bubble first.
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [activeChatId, allConvMessages.length, lastMsgTextLen, scrollToBottom, scrollToMessageId]);

  // ── Scroll-to-message: triggered from ChatSearch result ──
  useEffect(() => {
    if (!scrollToMessageId) return;
    const idx = allConvMessages.findIndex((m) => m.id === scrollToMessageId);
    if (idx < 0) {
      clearScrollToMessage();
      return;
    }
    // Expand pagination to include the target message
    const fromEnd = allConvMessages.length - idx;
    if (fromEnd > displayCount) {
      setDisplayCount(fromEnd + 10);
      return; // will re-run after displayCount update renders the target
    }
    // DOM should contain the target now — scroll after layout
    scrollingToTargetRef.current = true;
    clearScrollToMessage();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(`msg-${scrollToMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightMsgId(scrollToMessageId);
          setTimeout(() => setHighlightMsgId(null), 2000);
        }
        // Keep the guard up briefly so auto-scroll doesn't fight smooth scroll
        setTimeout(() => { scrollingToTargetRef.current = false; }, 600);
      }, 150);
    });
  }, [scrollToMessageId, allConvMessages, displayCount, clearScrollToMessage]);

  // ResizeObserver on the scroll container keeps the latest message
  // pinned to the bottom through flex reflows (orientation change,
  // search bar / picker toggle). If the user is actively touching the
  // scroll container we MUST NOT yank scrollTop back to the bottom —
  // that produces the "page jumps" the user reported when dragging at
  // the bottom of the chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (userTouchingRef.current || scrollingToTargetRef.current) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: Math.max(0, max - 1), behavior: 'auto' });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

    let ref: QuoteRef | undefined;
    if (quoteMsg) {
      const preview = getQuotePreviewText(quoteMsg);
      const refType: QuoteRef['type'] =
        quoteMsg.type === 'text'
          ? quoteMsg.noteRef
            ? 'note'
            : quoteMsg.songRef
              ? 'song'
              : 'text'
          : quoteMsg.type === 'image'
            ? 'image'
            : 'sticker';
      ref = {
        msgId: quoteMsg.id,
        senderId: quoteMsg.senderId,
        preview,
        type: refType,
      };
      setQuoteMsg(null);
    }

    sendMessage(activeChatId, text, ref);
    setInput('');
    setPickerMode('none');
    if (inputRef.current) inputRef.current.value = '';
  }, [input, activeChatId, sendMessage, quoteMsg]);

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
    (stickerUrl: string, stickerDesc: string) => {
      if (!activeChatId) return;
      sendStickerMessage(activeChatId, stickerUrl, stickerDesc);
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

  const getSenderName = useCallback(
    (senderId: string): string => {
      if (senderId === 'me') return persona?.name || userSettings.nickname || '我';
      const charId = senderId.replace(/^char-/, '');
      const ch = characters.find((c) => c.id === charId);
      if (ch) return ch.name;
      const idol = getIdol(senderId);
      return idol?.name || senderId;
    },
    [persona, userSettings, characters],
  );

  const handleLongPressMsg = useCallback((msg: Message, position: 'above' | 'below') => {
    setActionMenu({ msgId: msg.id, position });
  }, []);

  const handleQuoteTap = useCallback((msgId: string) => {
    useXYNav.setState({ scrollToMessageId: msgId });
  }, []);

  const handleForwardCardTap = useCallback((msg: Message) => {
    if (msg.type !== 'forward_card') return;
    useXYNav.getState().openForwardDetail({
      title: msg.forwardCard.title,
      messages: msg.forwardCard.messages,
    });
  }, []);

  const handleCloseMenu = useCallback(() => setActionMenu(null), []);

  const handleMessageAction = useCallback((type: ActionType, msg: Message) => {
    setActionMenu(null);
    switch (type) {
      case 'copy':
        if (msg.type === 'text') {
          const txt = msg.noteRef
            ? `${msg.noteRef.title}\n${msg.noteRef.body}`
            : msg.songRef
              ? `${msg.songRef.title} - ${msg.songRef.artist}`
              : msg.text;
          navigator.clipboard?.writeText(txt).catch(() => {});
          useToastStore.getState().show('已复制');
        }
        break;
      case 'favorite':
        addFavorite(msg, getSenderName(msg.senderId));
        useToastStore.getState().show('已收藏');
        break;
      case 'quote':
        setQuoteMsg(msg);
        inputRef.current?.focus();
        break;
      case 'forward':
        useXYNav.getState().openContactSelect([msg], 'single');
        break;
      case 'multiSelect':
        setMultiSelectMode(true);
        setSelectedMsgIds(new Set([msg.id]));
        break;
      case 'delete':
        deleteMessages([msg.id]);
        useToastStore.getState().show('已删除');
        break;
    }
  }, [addFavorite, deleteMessages, getSenderName]);

  const toggleMsgSelection = useCallback((msgId: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMsgIds(new Set());
  }, []);

  const handleMultiDelete = useCallback(() => {
    if (selectedMsgIds.size === 0) return;
    const count = selectedMsgIds.size;
    deleteMessages([...selectedMsgIds]);
    useToastStore.getState().show(`已删除 ${count} 条`);
    exitMultiSelect();
  }, [selectedMsgIds, deleteMessages, exitMultiSelect]);

  const handleMultiFavorite = useCallback(() => {
    const msgs = allConvMessages.filter((m) => selectedMsgIds.has(m.id));
    if (msgs.length === 0) return;
    addFavorites(msgs, getSenderName);
    useToastStore.getState().show(`已收藏 ${msgs.length} 条`);
    exitMultiSelect();
  }, [selectedMsgIds, allConvMessages, addFavorites, getSenderName, exitMultiSelect]);

  const handleBatchForward = useCallback(() => {
    if (selectedMsgIds.size === 0) return;
    const msgs = allConvMessages.filter((m) => selectedMsgIds.has(m.id));
    if (msgs.length === 0) return;
    useXYNav.getState().openContactSelect(msgs, 'batch');
    exitMultiSelect();
  }, [selectedMsgIds, allConvMessages, exitMultiSelect]);

  const handleMergeForward = useCallback(() => {
    if (selectedMsgIds.size === 0) return;
    const msgs = allConvMessages
      .filter((m) => selectedMsgIds.has(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (msgs.length === 0) return;
    useXYNav.getState().openContactSelect(msgs, 'merge');
    exitMultiSelect();
  }, [selectedMsgIds, allConvMessages, exitMultiSelect]);

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
          {multiSelectMode ? (
            <>
              <div className="flex w-1/4 items-center justify-start" />
              <div className="flex flex-1 items-center justify-center">
                <span style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
                  已选择 {selectedMsgIds.size} 条
                </span>
              </div>
              <div className="flex w-1/4 items-center justify-end pr-2">
                <motion.button
                  onClick={exitMultiSelect}
                  whileTap={{ opacity: 0.5 }}
                  transition={{ duration: 0 }}
                  style={{ fontSize: 16, color: T.accent }}
                >
                  取消
                </motion.button>
              </div>
            </>
          ) : (
            <>
              <div className="flex w-1/4 items-center justify-start">
                <motion.button
                  className="flex items-center justify-center gap-1"
                  onClick={closeChat}
                  whileTap={{ opacity: 0.5 }}
                  transition={{ duration: 0 }}
                >
                  <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
                  <span style={{ fontSize: 16, color: T.accent, marginLeft: -4 }}>消息</span>
                </motion.button>
              </div>

              <motion.button
                className="flex flex-1 flex-col items-center justify-center min-w-0 px-2"
                onClick={() => openIdol(peer.id)}
                whileTap={{ opacity: 0.5 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate" style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
                    {conv?.remarkName || peer.name}
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
                >
                  <Phone size={18} strokeWidth={2} color={T.textSecondary} />
                </motion.button>
                <motion.button
                  className="flex items-center justify-center"
                  style={{ width: 32, height: 32 }}
                  whileTap={{ opacity: 0.5 }}
                  onClick={openChatSettings}
                >
                  <MoreHorizontal size={18} strokeWidth={2} color={T.textSecondary} />
                </motion.button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Messages ──
          Messages stack from the top (WeChat/QQ-style block layout). A
          single message lives at the top of the container, not glued
          to the bottom. We do NOT use flex justify-end — it would look
          wrong in the no-keyboard state.

          Keyboard behavior: intentionally unhandled. iOS Safari's
          default `scrollToRevealFocusedElement` pushes the page up so
          the focused input is visible, same as every other iOS web
          app. See docs/plan/2026-04-11-1849-revert-keyboard-optimizations.md.
      */}
      <div
        ref={scrollRef}
        className="scrollbar-hide relative min-h-0 flex-1 overflow-y-auto px-4 pt-3"
        style={{
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '0.5rem',
          backgroundImage: conv?.backgroundUrl ? `url(${conv.backgroundUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Sentinel for loading older messages on scroll-up */}
        {hasMore && <div ref={sentinelRef} className="h-px" />}
        {visibleMessages.map((msg, i) => {
          const seen = seenMsgIdsRef.current;
          const shouldAnimate = seen !== null && !seen.has(msg.id);
          return (
            <MsgBubble
              key={msg.id}
              msg={msg}
              peer={peer}
              prevMsg={visibleMessages[i - 1]}
              onAvatarTap={openIdol}
              skipAnimation={!shouldAnimate}
              aiChatPeers={aiChatPeers}
              highlight={msg.id === highlightMsgId}
              actionMenuOpen={actionMenu?.msgId === msg.id}
              menuPosition={actionMenu?.position ?? 'above'}
              onLongPress={handleLongPressMsg}
              onAction={handleMessageAction}
              onCloseMenu={handleCloseMenu}
              onQuoteTap={handleQuoteTap}
              resolveSenderName={getSenderName}
              multiSelectMode={multiSelectMode}
              selected={selectedMsgIds.has(msg.id)}
              onToggleSelect={toggleMsgSelection}
              onForwardCardTap={handleForwardCardTap}
            />
          );
        })}
        {/* Typing dots: character 流式空 placeholder,或 legacy idol online 且最后一条是自己发的 */}
        {(() => {
          const last = visibleMessages[visibleMessages.length - 1];
          if (!last) return null;
          const lastText = (last.type === 'text' || last.type === 'heartbeat_log') ? last.text : undefined;
          // Group chats: dots only when an AI member is actively streaming a
          // placeholder. Auto-reply on user send is intentionally disabled —
          // replies are manually triggered via the member strip — so showing
          // a "typing" indicator after every user message would be a lie.
          if (conv?.groupMemberIds) {
            if (!last.streaming || lastText) return null;
            const charId = last.senderId.replace(/^char-/, '');
            const ch = characters.find((c) => c.id === charId);
            return (
              <TypingDots
                avatarSrc={ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR}
                ringIndex={0}
              />
            );
          }
          const isCharStreaming = conv.characterId && last.streaming && !lastText;
          const isLegacyTyping =
            !conv.characterId && peer.online && last.senderId === 'me';
          if (!isCharStreaming && !isLegacyTyping) return null;
          return <TypingDots avatarSrc={peer.avatar} ringIndex={peer.ringIndex} />;
        })()}
      </div>

      {/* ── Group member strip (above quote/input, group chats only) ── */}
      {conv?.groupMemberIds?.length && !multiSelectMode && !isViewingOther ? (
        <GroupMemberStrip
          memberIds={conv.groupMemberIds}
          generatingId={generatingMemberId}
          onTapMember={(characterId) => triggerGroupReply(conv.id, characterId)}
        />
      ) : null}

      {/* ── Quote preview bar (above input) ── */}
      {quoteMsg && !multiSelectMode && !conv?.aiChatParticipants && !isViewingOther && (
        <QuotePreview
          msg={quoteMsg}
          senderName={getSenderName(quoteMsg.senderId)}
          onClose={() => setQuoteMsg(null)}
        />
      )}

      {/* ── Input / Multi-select toolbar (hidden for observer/read-only modes) ── */}
      {multiSelectMode ? (
        <MultiSelectToolbar
          selectedCount={selectedMsgIds.size}
          onBatchForward={handleBatchForward}
          onMergeForward={handleMergeForward}
          onFavorite={handleMultiFavorite}
          onDelete={handleMultiDelete}
        />
      ) : conv?.aiChatParticipants || isViewingOther ? (
        <div className="flex shrink-0 items-center justify-center px-3" style={{ minHeight: 44, paddingBottom: 20, opacity: 0.5, fontSize: 13, color: T.textSecondary }}>
          {isViewingOther ? '只读模式 — 正在查看对方手机' : '旁观模式 — AI 角色间的私聊'}
        </div>
      ) : <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          minHeight: 56,
          paddingTop: 10,
          // 避开 iOS Home Indicator 手势区域（约 34px）
          paddingBottom:
            pickerMode === 'none'
              ? 'max(14px, calc(var(--safe-bottom, 0px) + 14px))'
              : 12,
          borderTop: `0.5px solid ${T.separator}`,
          backgroundColor: T.overlay,
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
      </div>}

      {/* ── Pickers ── */}
      <StickerPicker
        visible={pickerMode === 'sticker'}
        onSendSticker={handleSendSticker}
        onManage={() => {
          setPickerMode('none');
          openStickerManager('chat-detail');
        }}
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

/** AI-AI chat: two character peers, keyed by senderId */
interface AIChatPeers {
  /** senderId of the character rendered on the right side */
  rightSenderId: string;
  /** Map from senderId → { avatar, ringIndex } */
  peers: Record<string, { avatar: string; ringIndex: number }>;
}

const MsgBubble = memo(function MsgBubble({
  msg,
  peer,
  prevMsg,
  onAvatarTap,
  skipAnimation,
  aiChatPeers,
  highlight,
  actionMenuOpen,
  menuPosition,
  onLongPress,
  onAction,
  onCloseMenu,
  onQuoteTap,
  resolveSenderName,
  multiSelectMode,
  selected,
  onToggleSelect,
  onForwardCardTap,
}: {
  msg: Message;
  peer: { id: string; avatar: string; ringIndex: number; isGroup?: boolean };
  prevMsg?: Message;
  onAvatarTap?: (id: string) => void;
  skipAnimation?: boolean;
  /** For AI-AI conversations: provides both peers and which side each goes */
  aiChatPeers?: AIChatPeers;
  highlight?: boolean;
  actionMenuOpen?: boolean;
  menuPosition?: 'above' | 'below';
  onLongPress?: (msg: Message, position: 'above' | 'below') => void;
  onAction?: (type: ActionType, msg: Message) => void;
  onCloseMenu?: () => void;
  onQuoteTap?: (msgId: string) => void;
  resolveSenderName?: (senderId: string) => string;
  multiSelectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (msgId: string) => void;
  onForwardCardTap?: (msg: Message) => void;
}) {
  const { isSelf: perspectiveIsSelf, phoneOwnerId } = usePerspective();
  const isMine = aiChatPeers
    ? msg.senderId === aiChatPeers.rightSenderId
    : perspectiveIsSelf(msg.senderId);
  const showTime = !prevMsg || msg.timestamp - prevMsg.timestamp > 15 * 60_000;
  const [imgLoaded, setImgLoaded] = useState(false);
  const userSettings = useXYData((s) => s.userSettings);
  const characters = useCharacterStore((s) => s.characters);

  // AI 流式回复的占位 message 在开始的瞬间只有 streaming=true 还没有任何内容,
  // 如果照常渲染会出现一个"孤儿头像"(没有气泡),再叠加外层 TypingDots 的头像,
  // 就会看到两个头像堆在一起。遇到这种空 placeholder 直接不渲染,让 TypingDots
  // 独占视觉,文本到达时再走正常 MsgBubble 渲染路径。
  // heartbeat_log messages are internal activity records — never show in chat UI
  if (msg.type === 'heartbeat_log') return null;

  const hasContent =
    (msg.type === 'text' && !!msg.text) ||
    (msg.type === 'image' && !!msg.imageUrl) ||
    (msg.type === 'sticker' && !!msg.stickerUrl) ||
    msg.type === 'forward_card';

  const longPress = useLongPress((e) => {
    if (multiSelectMode) return;
    const el = (e.currentTarget as HTMLElement | null) ?? (e.target as HTMLElement | null);
    const rect = el?.getBoundingClientRect();
    const top = rect?.top ?? 0;
    onLongPress?.(msg, top < window.innerHeight / 2 ? 'below' : 'above');
  });

  if (!hasContent) return null;

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={skipAnimation ? false : { opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: highlight ? [T.accentLight, 'transparent'] : 'transparent',
      }}
      transition={{
        ...(skipAnimation ? { duration: 0 } : springs.gentle),
        backgroundColor: highlight ? { duration: 2, ease: 'easeOut' } : { duration: 0 },
      }}
      style={{ borderRadius: 12 }}
    >
      {showTime && (
        <div className="py-2.5 text-center">
          <span
            style={{
              fontSize: 11,
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: T.r.full,
              padding: '3px 10px',
            }}
          >
            {formatChatTime(msg.timestamp)}
          </span>
        </div>
      )}

      <div
        className={`mb-1.5 flex items-start ${isMine ? 'justify-end' : 'justify-start'}`}
        onClick={multiSelectMode ? () => onToggleSelect?.(msg.id) : undefined}
        style={multiSelectMode ? { cursor: 'pointer' } : undefined}
      >
        {multiSelectMode && (
          <div
            className="mr-2 flex shrink-0 items-center justify-center self-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: selected ? 'none' : `1.5px solid ${T.textMuted}`,
              backgroundColor: selected ? T.accent : 'transparent',
            }}
          >
            {selected && <Check size={14} strokeWidth={3} color="#fff" />}
          </div>
        )}
        {!isMine && (() => {
          // Group: every bubble must show its individual sender's avatar.
          // senderId is `char-${characterId}` and characterStore IDs themselves
          // start with `char-`, so strip exactly one `char-` to get the lookup key.
          let resolvedAvatar = peer.avatar;
          let resolvedRing = peer.ringIndex;
          let resolvedTapId = peer.id;
          if (peer.isGroup) {
            const charId = msg.senderId.replace(/^char-/, '');
            const ch = characters.find((c) => c.id === charId);
            if (ch) {
              resolvedAvatar = ch.avatar?.trim() || CHAR_FALLBACK_AVATAR;
              resolvedRing = 0;
              resolvedTapId = ch.id;
            }
          } else {
            const p = aiChatPeers?.peers[msg.senderId] ?? peer;
            resolvedAvatar = p.avatar;
            resolvedRing = p.ringIndex;
          }
          return (
            <motion.button
              className="mr-2 shrink-0"
              onClick={() => onAvatarTap?.(resolvedTapId)}
              whileTap={{ scale: 0.9 }}
              style={multiSelectMode ? { pointerEvents: 'none' } : undefined}
            >
              <Avatar src={resolvedAvatar} size={36} ringIndex={resolvedRing} />
            </motion.button>
          );
        })()}

        <div
          style={{
            maxWidth: msg.type === 'image' ? '58%' : '70%',
            touchAction: 'pan-y',
            ...(multiSelectMode ? { pointerEvents: 'none' as const } : {}),
          }}
          onPointerDown={multiSelectMode ? undefined : longPress.onPointerDown}
          onPointerUp={multiSelectMode ? undefined : longPress.onPointerUp}
          onPointerCancel={multiSelectMode ? undefined : longPress.onPointerCancel}
          onClick={multiSelectMode ? undefined : longPress.onClick}
        >
          {peer.isGroup && !isMine && resolveSenderName && (
            <div
              style={{
                fontSize: 11,
                color: T.textMuted,
                marginBottom: 3,
                paddingLeft: 2,
              }}
            >
              {resolveSenderName(msg.senderId)}
            </div>
          )}
          {actionMenuOpen && menuPosition === 'above' && (
            <AnimatePresence>
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <MessageActionBar
                  msg={msg}
                  position="above"
                  isMine={isMine}
                  onAction={onAction ?? (() => {})}
                  onClose={onCloseMenu ?? (() => {})}
                />
              </div>
            </AnimatePresence>
          )}
          {msg.type === 'sticker' && msg.stickerUrl && (
            <img
              src={msg.stickerUrl}
              alt={msg.stickerDesc || '表情'}
              draggable={false}
              style={{
                width: 120,
                height: 120,
                objectFit: 'contain',
                display: 'block',
                marginLeft: isMine ? 'auto' : undefined,
              }}
            />
          )}

          {msg.type === 'image' && msg.imageUrl && (
            <div
              style={{
                borderRadius: T.r.lg,
                overflow: 'hidden',
                boxShadow: T.shadow2,
                marginBottom: 0,
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

          {msg.type === 'text' && msg.noteRef ? (
            <button
              type="button"
              className="w-full text-left flex flex-col"
              onClick={() => {
                useAppRuntimeStore.getState().openApp('notes', null);
                setTimeout(() => {
                  useNotesNavStore.getState().reset();
                  useNotesNavStore.getState().push('editor', msg.noteRef!.noteId);
                }, 50);
              }}
              style={{
                borderRadius: 18,
                background: T.card,
                boxShadow: T.shadow1,
                border: `0.5px solid ${T.border}`,
                overflow: 'hidden',
                width: 250,
                // 取消气泡的不对称圆角，iOS Rich Link 通常是统一大圆角
                marginLeft: isMine ? 'auto' : undefined,
              }}
            >
              {/* Top: Note Preview Area */}
              <div
                className="relative w-full flex items-center justify-center p-4"
                style={{ 
                  aspectRatio: '4/3', 
                  background: 'linear-gradient(135deg, #FFF9D2 0%, #FCEB82 100%)',
                  borderBottom: `0.5px solid ${T.border}`,
                }}
              >
                {/* Simulated paper card inside */}
                <div
                  className="w-full h-full bg-white/80 rounded-md p-3 flex flex-col overflow-hidden"
                  style={{
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.8)'
                  }}
                >
                  <div
                    className="line-clamp-2"
                    style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2E', lineHeight: 1.3 }}
                  >
                    {msg.noteRef.title || '无标题备忘录'}
                  </div>
                  <div
                    className="line-clamp-3 mt-1.5"
                    style={{ fontSize: 13, color: '#666', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}
                  >
                    {msg.noteRef.body?.slice(0, 80) || '无附加文本'}
                  </div>
                </div>
              </div>
              
              {/* Bottom: Info & App Icon */}
              <div
                className="flex items-center justify-between w-full"
                style={{ padding: '12px 14px' }}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div
                    className="truncate"
                    style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, lineHeight: 1.2 }}
                  >
                    备忘录
                  </div>
                  <div
                    className="truncate"
                    style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.2, marginTop: 4 }}
                  >
                    通过 Cloud 分享
                  </div>
                </div>
                <img
                  src="/resource/icons/ios-system/notes.jpg"
                  alt="备忘录"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: '0.5px solid rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                />
              </div>
            </button>
          ) : msg.type === 'text' && msg.songRef ? (
            <button
              type="button"
              className="w-full text-left flex flex-col"
              onClick={() => {
                useAppRuntimeStore.getState().openApp('music', null);
              }}
              style={{
                borderRadius: 18,
                background: T.card,
                boxShadow: T.shadow1,
                border: `0.5px solid ${T.border}`,
                overflow: 'hidden',
                width: 250,
                marginLeft: isMine ? 'auto' : undefined,
              }}
            >
              {/* Top: Full width Artwork with Play Button */}
              <div
                className="relative w-full"
                style={{ aspectRatio: '1/1', backgroundColor: '#e5e5ea' }}
              >
                <img
                  src={msg.songRef.artworkUrl}
                  alt=""
                  className="block h-full w-full"
                  style={{ objectFit: 'cover' }}
                  draggable={false}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 48,
                      height: 48,
                      background: 'rgba(255,255,255,0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <Play size={24} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                  </div>
                </div>
              </div>
              
              {/* Bottom: Info & App Icon */}
              <div
                className="flex items-center justify-between w-full"
                style={{ padding: '12px 14px' }}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div
                    className="truncate"
                    style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, lineHeight: 1.2 }}
                  >
                    {msg.songRef.title}
                  </div>
                  <div
                    className="truncate"
                    style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.2, marginTop: 4 }}
                  >
                    {msg.songRef.artist}
                  </div>
                </div>
                <img
                  src="/resource/icons/ios-system/music.jpg"
                  alt="Music"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: '0.5px solid rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                />
              </div>
            </button>
          ) : msg.type === 'text' && msg.text && (
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
              {msg.quoteRef && onQuoteTap && (
                <QuoteBlock
                  quoteRef={msg.quoteRef}
                  isMine={isMine}
                  senderName={resolveSenderName?.(msg.quoteRef.senderId) ?? ''}
                  onTap={onQuoteTap}
                />
              )}
              {msg.text}
            </div>
          )}

          {msg.type === 'forward_card' && (
            <ForwardCardBubble
              msg={msg}
              isMine={isMine}
              onTap={(m) => onForwardCardTap?.(m)}
            />
          )}
          {actionMenuOpen && menuPosition === 'below' && (
            <AnimatePresence>
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <MessageActionBar
                  msg={msg}
                  position="below"
                  isMine={isMine}
                  onAction={onAction ?? (() => {})}
                  onClose={onCloseMenu ?? (() => {})}
                />
              </div>
            </AnimatePresence>
          )}
        </div>

        {isMine && (() => {
          const aiP = aiChatPeers?.peers[msg.senderId];
          // 查手机模式 (non-AI-AI conv): isMine = phone owner (AI) sent this message
          // → show the AI character's avatar, not the player's userSettings avatar
          const ownerChar = phoneOwnerId
            ? characters.find((c) => c.id === phoneOwnerId)
            : null;
          const selfAvatar = aiP?.avatar
            || ownerChar?.avatar?.trim()
            || userSettings.avatarUrl
            || DEFAULT_AVATAR;
          return (
          <motion.button
            className="ml-2 shrink-0"
            onClick={() => onAvatarTap?.(aiP ? peer.id : phoneOwnerId || 'me')}
            whileTap={{ scale: 0.9 }}
            style={multiSelectMode ? { pointerEvents: 'none' } : undefined}
          >
            <Avatar src={selfAvatar} size={36} ringIndex={aiP?.ringIndex ?? 0} />
          </motion.button>
          );
        })()}
      </div>
    </motion.div>
  );
});

/* ── Typing ── */

function TypingDots({ avatarSrc, ringIndex }: { avatarSrc: string; ringIndex: number }) {
  return (
    <div className="mb-2 flex items-end gap-2">
      <Avatar src={avatarSrc} size={36} ringIndex={ringIndex} />
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
