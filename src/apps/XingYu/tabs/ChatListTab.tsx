import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, type PanInfo } from 'motion/react';
import { Search, X, Trash2, MailOpen, MessageCircleHeart } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, formatTime, formatChatTime } from '../data';
import type { Conversation, Message } from '../data';
import { Avatar } from '../components/Avatar';
import { useCharacterStore } from '@/platform/stores/characterStore';
import type { CharacterCard } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import type { Persona } from '@/platform/stores/personaStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { T, springs } from '../theme';

/** 展开后红色删除按钮的宽度 (也是 x 的终止位置 abs 值) */
const OPEN_WIDTH = 88;
/** 手势方向锁定阈值 (px) — 小于此值不判定为拖拽 */
const AXIS_LOCK_THRESHOLD = 8;
/** 释放时滑动超过此值即 snap 到展开 */
const OPEN_SNAP_THRESHOLD = 40;
/** 释放时的速度阈值 (px/s),快速一挥也能 snap 开 */
const VELOCITY_SNAP_THRESHOLD = 500;
/** 拖拽后点击抑制时长 (ms) — 确保松手后一段时间内的 click 被吞掉 */
const TAP_SUPPRESS_MS = 280;
/** Character 对话头像兜底 */
const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';
/** 消息搜索分页尺寸 */
const SEARCH_PAGE_SIZE = 20;

/** ChatListTab 里显示 conv 需要的 peer 信息,兼容 mock idol 和 character */
interface ConvPeer {
  name: string;
  avatar: string;
  ringIndex: number;
  online: boolean;
  isGroup: boolean;
  memberCount?: number;
  /** True for AI-AI conversations — drives the "AI 互动" badge. */
  isAIChat?: boolean;
}

export function ChatListTab() {
  const conversations = useXYData((s) => s.conversations);
  const allMessages = useXYData((s) => s.messages);
  const deleteConversation = useXYData((s) => s.deleteConversation);
  const openChat = useXYNav((s) => s.openChat);
  const openChatToMessage = useXYNav((s) => s.openChatToMessage);
  const characters = useCharacterStore((s) => s.characters);
  const persona = usePersonaStore((s) => s.getActivePersona());
  const userSettings = useXYData((s) => s.userSettings);
  const { phoneOwnerId } = usePerspective();
  const [query, setQuery] = useState('');
  /** 搜索结果分页:每次显示 PAGE_SIZE 条,点"加载更多"再追加 */
  const [searchPage, setSearchPage] = useState(1);
  /** 当前处于"展开-露出删除按钮"状态的 conv id; 同一时刻只允许一行展开 */
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // 查询变化时重置分页
  useEffect(() => {
    setSearchPage(1);
  }, [query]);

  // 按时间倒序排列,根据视角过滤对话:
  //   玩家手机 → 排除 AI-AI 后台对话(玩家不应看到 AI 之间的私聊)
  //   AI 手机   → 包括 user-AI + AI-AI(都是 AI 的真实通讯记录)
  // AI-AI 行通过 peer.isAIChat 标记后,在列表渲染时显示"AI 互动"小标签,
  // 避免和"和用户的对话"混淆。
  const sorted = useMemo(() => {
    const filtered = phoneOwnerId === null
      ? conversations.filter((c) => !c.aiChatParticipants)
      : conversations.filter(
          (c) =>
            c.characterId === phoneOwnerId ||
            c.aiChatParticipants?.includes(phoneOwnerId),
        );
    return [...filtered].sort((a, b) => b.lastTime - a.lastTime);
  }, [conversations, phoneOwnerId]);

  // 当查询非空时,搜索消息(而非对话);只在视角可见的会话内搜索
  const messageResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const visibleConvIds = new Set(sorted.map((c) => c.id));
    const convById = new Map(sorted.map((c) => [c.id, c]));
    const results: MessageSearchResult[] = [];
    for (const m of allMessages) {
      if (!visibleConvIds.has(m.convId)) continue;
      const text = extractSearchableText(m);
      if (!text) continue;
      const lower = text.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx < 0) continue;
      const conv = convById.get(m.convId)!;
      results.push({ msg: m, conv, text, matchIndex: idx, matchLength: q.length });
    }
    results.sort((a, b) => b.msg.timestamp - a.msg.timestamp);
    return results;
  }, [query, sorted, allMessages]);

  const visibleResultCount = searchPage * SEARCH_PAGE_SIZE;
  const visibleResults = useMemo(
    () => messageResults.slice(0, visibleResultCount),
    [messageResults, visibleResultCount],
  );
  const hasMoreResults = messageResults.length > visibleResults.length;

  // 列表滚动时收起已展开的行 — WeChat 风格
  const handleListScroll = useCallback(() => {
    if (openRowId) setOpenRowId(null);
  }, [openRowId]);

  const handleRowTap = useCallback(
    (convId: string) => {
      // 若当前有其他行处于展开态,一次轻点只用来收起它,不打开会话
      if (openRowId && openRowId !== convId) {
        setOpenRowId(null);
        return;
      }
      openChat(convId);
    },
    [openRowId, openChat],
  );

  const handleRowOpen = useCallback((convId: string) => {
    setOpenRowId(convId);
  }, []);

  const handleRowCloseRequest = useCallback(() => {
    setOpenRowId(null);
  }, []);

  const handleRowDelete = useCallback(
    (convId: string) => {
      setOpenRowId(null);
      deleteConversation(convId);
    },
    [deleteConversation],
  );

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

      {/* Conversation list / search results */}
      <div
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-white"
        onScroll={handleListScroll}
      >
        {query.trim() ? (
          messageResults.length === 0 ? (
            <motion.div
              className="flex flex-col items-center py-20"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <MailOpen size={40} strokeWidth={1.5} style={{ marginBottom: 12, color: T.textMuted }} />
              <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>
                没有找到相关消息
              </span>
            </motion.div>
          ) : (
            <>
              {visibleResults.map((r, i) => (
                <motion.div
                  key={r.msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2), ...springs.gentle }}
                >
                  <MessageResultRow
                    result={r}
                    characters={characters}
                    persona={persona ?? null}
                    userSettingsAvatar={userSettings.avatarUrl}
                    phoneOwnerId={phoneOwnerId}
                    onTap={() => openChatToMessage(r.conv.id, r.msg.id)}
                  />
                </motion.div>
              ))}
              {hasMoreResults ? (
                <motion.button
                  type="button"
                  className="flex w-full items-center justify-center"
                  style={{
                    padding: '14px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: T.accent,
                    background: 'transparent',
                  }}
                  whileTap={{ opacity: 0.5 }}
                  transition={{ duration: 0 }}
                  onClick={() => setSearchPage((p) => p + 1)}
                >
                  加载更多 (剩余 {messageResults.length - visibleResults.length} 条)
                </motion.button>
              ) : messageResults.length > SEARCH_PAGE_SIZE ? (
                <div
                  className="flex w-full items-center justify-center"
                  style={{ padding: '14px 16px', fontSize: 12, color: T.textMuted }}
                >
                  共 {messageResults.length} 条结果
                </div>
              ) : null}
            </>
          )
        ) : sorted.length === 0 ? (
          <motion.div
            className="flex flex-col items-center py-20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MessageCircleHeart size={40} strokeWidth={1.5} style={{ marginBottom: 12, color: T.textMuted }} />
            <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>
              还没有对话,去通讯录开聊吧
            </span>
          </motion.div>
        ) : (
          sorted.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ...springs.gentle }}
            >
              <ConvRow
                conv={conv}
                isOpen={openRowId === conv.id}
                onOpen={() => handleRowOpen(conv.id)}
                onCloseRequest={handleRowCloseRequest}
                onTap={() => handleRowTap(conv.id)}
                onDelete={() => handleRowDelete(conv.id)}
              />
            </motion.div>
          ))
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

interface ConvRowProps {
  conv: Conversation;
  isOpen: boolean;
  onOpen: () => void;
  onCloseRequest: () => void;
  onTap: () => void;
  onDelete: () => void;
}

function ConvRow({ conv, isOpen, onOpen, onCloseRequest, onTap, onDelete }: ConvRowProps) {
  /** 横向位移 motion value — 每帧 60fps 不走 React state (src/CLAUDE.md 踩坑 3) */
  const x = useMotionValue(0);
  const characters = useCharacterStore((s) => s.characters);
  const { phoneOwnerId } = usePerspective();
  const persona = usePersonaStore((s) => s.getActivePersona());
  const userSettings = useXYData((s) => s.userSettings);

  /** 手势瞬态状态 — 全部用 ref,避免 React 异步 state 在 panEnd 读到过期值 (src/CLAUDE.md 踩坑 4) */
  /** panStart 时的 x 位置,支持"半展开再拖"场景 */
  const baseXRef = useRef(0);
  /** 已锁定的手势方向; 锁到 'y' 后本次 pan 交回浏览器纵向滚动 */
  const lockedAxisRef = useRef<'x' | 'y' | null>(null);
  /** 本次手势是否真正产生了横向拖拽 — true 时后续 click 必须被吞掉 */
  const didPanRef = useRef(false);
  /** 最近一次"拖拽结束"的时间戳,用于抑制紧随其后的合成 click */
  const lastPanEndAtRef = useRef(0);

  // 兼容 mock idol、character、用户自建群聊、AI-AI 会话
  // 查手机模式下需要视角化: AI-AI 会话显示对方 AI, AI-玩家会话显示玩家
  const peer: ConvPeer | null = useMemo(() => {
    // AI-to-AI 会话
    if (conv.aiChatParticipants) {
      const [id1, id2] = conv.aiChatParticipants;
      const ch1 = characters.find((c) => c.id === id1);
      const ch2 = characters.find((c) => c.id === id2);
      if (!ch1 || !ch2) return null;
      // 查手机模式: 显示对方角色名
      if (phoneOwnerId) {
        const otherId = id1 === phoneOwnerId ? id2 : id1;
        const other = characters.find((c) => c.id === otherId);
        if (!other) return null;
        return {
          name: other.name,
          avatar: other.avatar?.trim() || CHAR_FALLBACK_AVATAR,
          ringIndex: 0,
          online: true,
          isGroup: false,
          isAIChat: true,
        };
      }
      return {
        name: `${ch1.name} & ${ch2.name}`,
        avatar: ch1.avatar?.trim() || CHAR_FALLBACK_AVATAR,
        ringIndex: 0,
        online: true,
        isGroup: false,
        isAIChat: true,
      };
    }
    // 用户自建群聊
    if (conv.groupName && conv.groupMemberIds) {
      return {
        name: conv.groupName,
        avatar: '/resource/avatars/idol-starlight.jpg',
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
          name: persona?.name || '用户',
          avatar: persona?.avatar || userSettings.avatarUrl || CHAR_FALLBACK_AVATAR,
          ringIndex: 0,
          online: true,
          isGroup: false,
        };
      }
      const ch = characters.find((c) => c.id === conv.characterId);
      if (!ch) return null;
      return {
        name: ch.name,
        avatar: ch.avatar?.trim() || CHAR_FALLBACK_AVATAR,
        ringIndex: 0,
        online: true,
        isGroup: false,
      };
    }
    const idol = getIdol(conv.idolId);
    if (!idol) return null;
    return {
      name: idol.name,
      avatar: idol.avatar,
      ringIndex: idol.ringIndex,
      online: idol.online,
      isGroup: idol.isGroup ?? false,
      memberCount: idol.memberCount,
    };
  }, [conv.characterId, conv.idolId, conv.groupName, conv.groupMemberIds, conv.aiChatParticipants, characters, phoneOwnerId, persona, userSettings]);

  // 外部 isOpen 变化时 (例如别的行被展开触发本行收起) 同步动画。
  // 跳过首次 mount 的 0→0 动画,避免和后续 pan 的 x 更新抢夺控制权。
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      x.set(isOpen ? -OPEN_WIDTH : 0);
      return;
    }
    const controls = animate(x, isOpen ? -OPEN_WIDTH : 0, springs.gentle);
    return () => controls.stop();
  }, [isOpen, x]);

  const handlePanStart = useCallback(() => {
    baseXRef.current = x.get();
    lockedAxisRef.current = null;
    didPanRef.current = false;
  }, [x]);

  const handlePan = useCallback(
    (_: unknown, info: PanInfo) => {
      const dx = info.offset.x;
      const dy = info.offset.y;

      // 首次超过阈值时决定方向 — 横向即进入我们的拖拽路径,纵向交回浏览器
      if (lockedAxisRef.current === null) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < AXIS_LOCK_THRESHOLD && ady < AXIS_LOCK_THRESHOLD) return;
        lockedAxisRef.current = adx > ady ? 'x' : 'y';
        if (lockedAxisRef.current === 'y') return;
        didPanRef.current = true;
      }

      if (lockedAxisRef.current !== 'x') return;

      // 从 baseX 开始跟随手指;超出 [-OPEN_WIDTH, 0] 区间给 0.3 的橡皮筋阻尼
      let next = baseXRef.current + dx;
      if (next > 0) {
        next = next * 0.3;
      } else if (next < -OPEN_WIDTH) {
        next = -OPEN_WIDTH + (next + OPEN_WIDTH) * 0.3;
      }
      x.set(next);
    },
    [x],
  );

  const handlePanEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      // 未进入横向拖拽 — 什么也不改,交给 click 处理
      if (lockedAxisRef.current !== 'x') {
        lockedAxisRef.current = null;
        return;
      }
      lockedAxisRef.current = null;
      lastPanEndAtRef.current = Date.now();

      // 决策: 当前位置过半 OR 速度够快 → 展开;否则回弹
      const currentX = x.get();
      const shouldOpen =
        currentX < -OPEN_SNAP_THRESHOLD ||
        info.velocity.x < -VELOCITY_SNAP_THRESHOLD;

      // 立刻开始物理回弹动画 — 不能等 parent 的 isOpen 变化 useEffect,
      // 因为 isOpen 可能本来就没变 (比如起点就是关闭态且这次拖拽又回到了 0)。
      animate(x, shouldOpen ? -OPEN_WIDTH : 0, springs.gentle);

      if (shouldOpen) {
        onOpen();
      } else {
        onCloseRequest();
      }
    },
    [x, onOpen, onCloseRequest],
  );

  const handleTap = useCallback(() => {
    // 刚刚结束一次横向拖拽 → 吞掉合成 click,不打开会话
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (Date.now() - lastPanEndAtRef.current < TAP_SUPPRESS_MS) {
      return;
    }
    onTap();
  }, [onTap]);

  if (!peer) return null;

  return (
    <div className="relative" style={{ overflow: 'hidden', backgroundColor: T.card }}>
      {/* 后置的红色删除按钮 — 被前景行盖住,滑动时才露出 */}
      <div
        className="absolute top-0 bottom-0 right-0 flex"
        style={{ width: OPEN_WIDTH }}
      >
        <button
          type="button"
          className="flex h-full w-full flex-col items-center justify-center"
          style={{
            backgroundColor: '#FF3B30',
            color: '#fff',
            gap: 2,
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={20} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>删除</span>
        </button>
      </div>

      {/* 前景可拖拽行 — 用 Framer Motion 的 onPan* 低阶事件手动控制 x,
          避免 drag="x" + 自定义 motion value + dragMomentum=false 的组合陷阱 */}
      <motion.div
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        onTap={handleTap}
        className="relative flex w-full items-center gap-3.5"
        style={{
          x,
          padding: '12px 16px',
          backgroundColor: T.card,
          WebkitUserSelect: 'none',
          userSelect: 'none',
          cursor: 'pointer',
          // 允许浏览器纵向滚动,横向由我们的 onPan 接管
          touchAction: 'pan-y',
        }}
      >
        <div className="relative">
          <Avatar
            src={peer.avatar}
            size={50}
            ringIndex={peer.ringIndex}
            online={peer.online}
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
                {conv.remarkName || peer.name}
              </span>
              {peer.isGroup && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.accent,
                    background: 'rgba(0,122,255,0.1)',
                    borderRadius: T.r.xs,
                    padding: '2px 6px',
                  }}
                >
                  {peer.memberCount}人
                </span>
              )}
              {peer.isAIChat && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#8B5CF6',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: T.r.xs,
                    padding: '2px 6px',
                  }}
                >
                  AI 互动
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: T.textMuted,
              }}
            >
              {formatTime(conv.lastTime)}
            </span>
          </div>
          <span
            className="truncate"
            style={{
              fontSize: 14,
              color: T.textSecondary,
              fontWeight: 400,
              maxWidth: '100%',
              lineHeight: 1.4,
              textAlign: 'left',
            }}
          >
            {conv.lastMsg}
          </span>
        </div>

        {/* iOS 风格分隔线 */}
        <div
          className="absolute bottom-0 right-0"
          style={{
            height: 0.5,
            backgroundColor: T.separator,
            left: 80,
          }}
        />
      </motion.div>
    </div>
  );
}

/* ── Message search ── */

interface MessageSearchResult {
  msg: Message;
  conv: Conversation;
  text: string;
  matchIndex: number;
  matchLength: number;
}

function extractSearchableText(m: Message): string {
  if (m.type === 'text') return m.text ?? '';
  if (m.type === 'heartbeat_log') return m.text ?? '';
  if (m.type === 'forward_card') {
    const lines = m.forwardCard.messages
      .map((fm) => (fm.type === 'text' ? fm.text ?? '' : ''))
      .filter(Boolean);
    return [m.forwardCard.title, ...lines].join('\n');
  }
  return '';
}

function resolveConvPeer(
  conv: Conversation,
  characters: CharacterCard[],
  phoneOwnerId: string | null,
  persona: Persona | null,
  userSettingsAvatar: string | undefined,
): { name: string; avatar: string } | null {
  if (conv.aiChatParticipants) {
    const [id1, id2] = conv.aiChatParticipants;
    const ch1 = characters.find((c) => c.id === id1);
    const ch2 = characters.find((c) => c.id === id2);
    if (!ch1 || !ch2) return null;
    if (phoneOwnerId) {
      const otherId = id1 === phoneOwnerId ? id2 : id1;
      const other = characters.find((c) => c.id === otherId);
      if (!other) return null;
      return { name: other.name, avatar: other.avatar?.trim() || CHAR_FALLBACK_AVATAR };
    }
    return {
      name: `${ch1.name} & ${ch2.name}`,
      avatar: ch1.avatar?.trim() || CHAR_FALLBACK_AVATAR,
    };
  }
  if (conv.groupName && conv.groupMemberIds) {
    return { name: conv.groupName, avatar: '/resource/avatars/idol-starlight.jpg' };
  }
  if (conv.characterId) {
    if (phoneOwnerId && conv.characterId === phoneOwnerId) {
      return {
        name: persona?.name || '用户',
        avatar: persona?.avatar || userSettingsAvatar || CHAR_FALLBACK_AVATAR,
      };
    }
    const ch = characters.find((c) => c.id === conv.characterId);
    if (!ch) return null;
    return { name: ch.name, avatar: ch.avatar?.trim() || CHAR_FALLBACK_AVATAR };
  }
  const idol = getIdol(conv.idolId);
  if (!idol) return null;
  return { name: idol.name, avatar: idol.avatar };
}

interface MessageResultRowProps {
  result: MessageSearchResult;
  characters: CharacterCard[];
  persona: Persona | null;
  userSettingsAvatar: string | undefined;
  phoneOwnerId: string | null;
  onTap: () => void;
}

function MessageResultRow({
  result,
  characters,
  persona,
  userSettingsAvatar,
  phoneOwnerId,
  onTap,
}: MessageResultRowProps) {
  const { msg, conv, text, matchIndex, matchLength } = result;
  const peer = useMemo(
    () => resolveConvPeer(conv, characters, phoneOwnerId, persona, userSettingsAvatar),
    [conv, characters, phoneOwnerId, persona, userSettingsAvatar],
  );
  if (!peer) return null;

  const isMine = msg.senderId === 'me';
  const senderLabel = isMine ? '我' : peer.name;

  return (
    <motion.div
      onClick={onTap}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
      transition={{ duration: 0 }}
      className="relative flex w-full items-start gap-3"
      style={{
        padding: '10px 16px',
        backgroundColor: T.card,
        cursor: 'pointer',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <Avatar src={peer.avatar} size={40} ringIndex={0} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span
              className="truncate"
              style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}
            >
              {conv.remarkName || peer.name}
            </span>
            <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
              · {senderLabel}
            </span>
          </div>
          <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
            {formatChatTime(msg.timestamp)}
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            color: T.textSecondary,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          <Snippet text={text} matchIndex={matchIndex} matchLength={matchLength} />
        </span>
      </div>
      <div
        className="absolute bottom-0 right-0"
        style={{ height: 0.5, backgroundColor: T.separator, left: 68 }}
      />
    </motion.div>
  );
}

function Snippet({
  text,
  matchIndex,
  matchLength,
}: {
  text: string;
  matchIndex: number;
  matchLength: number;
}) {
  const WINDOW = 24;
  const start = Math.max(0, matchIndex - WINDOW);
  const end = Math.min(text.length, matchIndex + matchLength + WINDOW);
  const before = text.slice(start, matchIndex);
  const match = text.slice(matchIndex, matchIndex + matchLength);
  const after = text.slice(matchIndex + matchLength, end);
  return (
    <>
      {start > 0 && '…'}
      {before}
      <span style={{ color: T.accent, fontWeight: 600 }}>{match}</span>
      {after}
      {end < text.length && '…'}
    </>
  );
}
